import { RenderModuleContext, RenderModule, DerivedRenderState, RenderState, CoordSpace, createDefaultModules } from "./";
import { glBuffer, glExtensions, glState, glUpdateBuffer, createUniformsProxy, UniformsProxy, glTexture, glSampler, TextureParamsCubeUncompressedMipMapped, TextureParamsCubeUncompressed } from "webgl2";
import { matricesFromRenderState } from "./matrices";
import { createViewFrustum } from "./viewFrustum";
import { RenderBuffers } from "./buffers";
import { WasmInstance } from "./wasm";
import { mat3, mat4, ReadonlyVec3, vec3, vec4 } from "gl-matrix";

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
}

// the context is re-created from scratch if the underlying webgl2 context is lost
export class RenderContext {
    private static defaultModules: readonly RenderModule[] | undefined;
    private readonly modules: readonly RenderModule[];
    private readonly moduleContexts: (RenderModuleContext | undefined)[];
    private cameraUniformsData;
    private localSpaceTranslation = vec3.create() as ReadonlyVec3;
    readonly gl: WebGL2RenderingContext;

    // copy from last rendered state
    private isOrtho = false;
    private viewClipMatrix = mat4.create();
    private viewWorldMatrix = mat4.create();
    private viewWorldMatrixNormal = mat3.create();

    readonly defaultIBLTextureParams: TextureParamsCubeUncompressed;

    // constant gl resources
    readonly cameraUniforms: WebGLBuffer;
    readonly lut_ggx: WebGLTexture;
    readonly samplerMip: WebGLSampler; // use to read diffuse texture
    readonly samplerSingle: WebGLSampler; // use to read the other textures

    // shared mutable state
    prevState: DerivedRenderState | undefined;
    changed = true; // flag to force a re-render when internal render module state has changed, e.g. on download complete.
    buffers: RenderBuffers = undefined!; // output render buffers. will be set on first render as part of resize.
    iblTextures: { // these are changed by the background module, once download is complete
        readonly diffuse: WebGLTexture; // irradiance cubemap
        readonly specular: WebGLTexture; // radiance cubemap
        readonly numMipMaps: number; // # of radiance/specular mip map levels.
    };
    clippingUniforms: WebGLBuffer | undefined;

    constructor(readonly canvas: HTMLCanvasElement, readonly wasm: WasmInstance, lut_ggx: TexImageSource, options?: WebGLContextAttributes, modules?: readonly RenderModule[]) {
        // init gl context
        const gl = canvas.getContext("webgl2", options);
        if (!gl)
            throw new Error("Unable to create WebGL 2 context!");
        this.gl = gl;
        const extensions = glExtensions(gl, true);
        console.assert(extensions.loseContext != null, extensions.multiDraw != null, extensions.colorBufferFloat != null);

        // ggx lookup texture and ibl samplers
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        this.lut_ggx = glTexture(gl, { kind: "TEXTURE_2D", internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: lut_ggx });
        this.samplerSingle = glSampler(gl, { minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        this.samplerMip = glSampler(gl, { minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });

        // create default ibl textures
        const top = new Uint8Array([192, 192, 192, 255]);
        const side = new Uint8Array([128, 128, 128, 255]);
        const bottom = new Uint8Array([64, 64, 64, 255]);
        const image = [side, side, top, bottom, side, side] as const;
        const textureParams = this.defaultIBLTextureParams = { kind: "TEXTURE_CUBE_MAP", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: image } as const;
        this.iblTextures = {
            diffuse: glTexture(gl, textureParams),
            specular: glTexture(gl, textureParams),
            numMipMaps: 1,
        };

        // initialize modules
        this.modules = modules ?? RenderContext.defaultModules ?? RenderContext.defaultModules ?? createDefaultModules();
        RenderContext.defaultModules = this.modules;
        this.moduleContexts = this.modules.map((m, i) => {
            const module = m.withContext(this);
            if (!isPromise(module)) {
                return module;
            }
            module.then(m => {
                this.moduleContexts[i] = m;
            });
        });

        // camera uniforms
        this.cameraUniformsData = createUniformsProxy({
            clipViewMatrix: "mat4",
            viewClipMatrix: "mat4",
            localViewMatrix: "mat4",
            viewLocalMatrix: "mat4",
            worldViewMatrixNormal: "mat3",
            viewWorldMatrixNormal: "mat3",
        });
        this.cameraUniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: this.cameraUniformsData.buffer.byteLength + 256 });
    }

    private deleteIblTextures() {
        const { gl, iblTextures } = this;
        const { diffuse, specular } = iblTextures;
        gl.deleteTexture(diffuse);
        gl.deleteTexture(specular);
    }

    dispose() {
        const { gl, cameraUniforms, buffers, moduleContexts, lut_ggx, samplerSingle, samplerMip } = this;
        this.deleteIblTextures();
        gl.deleteTexture(lut_ggx);
        gl.deleteSampler(samplerSingle);
        gl.deleteSampler(samplerMip);
        gl.deleteBuffer(cameraUniforms);
        buffers?.dispose();
        for (const module of moduleContexts) {
            module?.dispose();
        }
    }

    // use a pre-pass to fill in z-buffer for improved fill rate at the expense of triangle rate (useful when doing heavy shading, but unclear how efficient this is on tiled GPUs.)
    readonly usePrepass = false;

    get width() {
        return this.gl.drawingBufferWidth;
    }

    get height() {
        return this.gl.drawingBufferHeight;
    }

    isContextLost() {
        return this.gl.isContextLost();
    }

    updateUniformBuffer(uniformBuffer: WebGLBuffer, proxy: UniformsProxy) {
        if (!proxy.dirtyRange.isEmpty) {
            const { begin, end } = proxy.dirtyRange;
            glUpdateBuffer(this.gl, { kind: "UNIFORM_BUFFER", srcData: proxy.buffer, targetBuffer: uniformBuffer, srcOffset: begin, targetOffset: begin, size: end - begin });
            proxy.dirtyRange.clear();
        }
    }

    updateIBLTextures(params: { readonly diffuse: TextureParamsCubeUncompressed, readonly specular: TextureParamsCubeUncompressedMipMapped } | null) {
        const { gl } = this;
        this.deleteIblTextures();
        if (params) {
            const { diffuse, specular } = params;
            this.iblTextures = {
                diffuse: glTexture(gl, diffuse),
                specular: glTexture(gl, specular),
                numMipMaps: typeof specular.mipMaps == "number" ? specular.mipMaps : specular.mipMaps.length,
            };
        } else {
            this.iblTextures = {
                diffuse: glTexture(gl, this.defaultIBLTextureParams),
                specular: glTexture(gl, this.defaultIBLTextureParams),
                numMipMaps: 1,
            };
        }
    }

    hasStateChanged(state: Partial<DerivedRenderState>) {
        const { prevState } = this;
        let changed = false;
        // do a shallow reference comparison of root properties
        for (const prop in state) {
            const p = prop as keyof RenderState;
            if (!prevState || prevState[p] !== state[p]) {
                changed = true;
                break;
            }
        }
        return changed;
    }


    protected contextLost() {
        for (const module of this.moduleContexts) {
            module?.contextLost();
        }
    }

    protected poll() {
        this.buffers?.pollPickFence();
    }

    protected render(state: RenderState) {
        const beginTime = performance.now();
        const { gl, canvas, prevState } = this;
        this.changed = false;

        // handle resizes
        let resized = false;
        if (state.output !== prevState?.output) {
            const { width, height } = state.output;
            console.assert(Number.isInteger(width) && Number.isInteger(height));
            canvas.width = width;
            canvas.height = height;
            resized = true;
            this.changed = true;
            this.buffers?.dispose();
            this.buffers = new RenderBuffers(gl, width, height);
        }
        this.buffers.readBuffersNeedUpdate = true;

        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const derivedState = state as Mutable<DerivedRenderState>;
        if (resized || state.camera !== prevState?.camera) {
            const snapDist = 1024; // make local space roughly within 1KM of camera
            const dist = Math.max(...vec3.sub(vec3.create(), state.camera.position, this.localSpaceTranslation).map(c => Math.abs(c)));
            // don't change localspace unless camera is far enough away. we want to avoid flipping back and forth across snap boundaries.
            if (dist >= snapDist) {
                function snap(v: number) {
                    return Math.round(v / snapDist) * snapDist;
                }
                this.localSpaceTranslation = vec3.fromValues(...(state.camera.position.map(v => snap(v)) as [number, number, number]))
            }

            derivedState.localSpaceTranslation = this.localSpaceTranslation; // update the object reference to indicate that values have changed
            derivedState.matrices = matricesFromRenderState(state);
            derivedState.viewFrustum = createViewFrustum(state, derivedState.matrices);
        }
        this.updateCameraUniforms(derivedState);
        this.updateUniformBuffer(this.cameraUniforms, this.cameraUniformsData);

        // update internal state
        this.isOrtho = derivedState.camera.kind == "orthographic";
        mat4.copy(this.viewClipMatrix, derivedState.matrices.getMatrix(CoordSpace.View, CoordSpace.Clip));
        mat4.copy(this.viewWorldMatrix, derivedState.matrices.getMatrix(CoordSpace.View, CoordSpace.World));
        mat3.copy(this.viewWorldMatrixNormal, derivedState.matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World));

        // update modules from state
        for (const module of this.moduleContexts) {
            module?.update(derivedState);
        }

        // apply module render z-buffer pre-pass
        const { width, height } = canvas;
        if (this.usePrepass) {
            for (const module of this.moduleContexts) {
                if (module && module.prepass) {
                    glState(gl, {
                        viewport: { width, height },
                        frameBuffer: this.buffers.resources.frameBuffer,
                        drawBuffers: [],
                        // colorMask: [false, false, false, false],
                    })
                    module.prepass(derivedState);
                    // reset gl state
                    glState(gl, null);
                }
            }
        }

        // render modules
        for (const module of this.moduleContexts) {
            if (module) {
                glState(gl, {
                    viewport: { width, height },
                    frameBuffer: this.buffers.resources.frameBuffer,
                    drawBuffers: ["COLOR_ATTACHMENT0"],
                })
                module.render(derivedState);
                // reset gl state
                glState(gl, null);
            }
        }

        this.buffers.invalidate();
        this.prevState = derivedState;

        const endTime = performance.now();
        // console.log(endTime - beginTime);
    }

    private updateCameraUniforms(state: DerivedRenderState) {
        const { gl, cameraUniformsData, localSpaceTranslation } = this;
        const { matrices } = state;
        const { values } = cameraUniformsData;
        const worldViewMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.View);
        const viewWorldMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.World);
        const worldLocalMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), localSpaceTranslation));
        const localWorldMatrix = mat4.fromTranslation(mat4.create(), localSpaceTranslation);
        values.clipViewMatrix = matrices.getMatrix(CoordSpace.Clip, CoordSpace.View);
        values.viewClipMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        values.viewClipMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        values.localViewMatrix = mat4.multiply(mat4.create(), worldViewMatrix, localWorldMatrix);
        values.viewLocalMatrix = mat4.multiply(mat4.create(), worldLocalMatrix, viewWorldMatrix,);
        values.worldViewMatrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
        values.viewWorldMatrixNormal = matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World);
    }

    protected async pick(x: number, y: number, sampleDiscRadius = 0): Promise<PickSample[]> {
        if (sampleDiscRadius < 0)
            return [];
        const { canvas, wasm, buffers, width, height } = this;
        const rect = canvas.getBoundingClientRect(); // dim in css pixels
        const cssWidth = rect.width;
        const cssHeight = rect.height;
        // convert to pixel coords
        const px = Math.round(x / cssWidth * width);
        const py = Math.round((1 - (y + 0.5) / cssHeight) * height);
        console.assert(px >= 0 && py >= 0 && px < width && py < height);
        const { normals, depths, infos } = await buffers.pickBuffers();

        // fetch sample rectangle from read buffers
        const r = Math.ceil(sampleDiscRadius);
        const r2 = sampleDiscRadius * sampleDiscRadius;
        let x0 = px - r;
        let x1 = px + r + 1;
        let y0 = py - r;
        let y1 = py + r + 1;
        if (x0 < 0) x0 = 0;
        if (x1 > width) x1 = width;
        if (y0 < 0) y0 = 0;
        if (y1 > width) y1 = width;
        const samples: PickSample[] = [];
        const { isOrtho, viewClipMatrix, viewWorldMatrix, viewWorldMatrixNormal } = this;
        for (let iy = y0; iy < y1; iy++) {
            const dy = iy - py;
            for (let ix = x0; ix < x1; ix++) {
                const dx = ix - px;
                if (dx * dx + dy * dy > r2)
                    continue; // filter out samples that lie outside sample disc radius
                const buffOffs = ix + iy * width;
                const objectId = infos[buffOffs * 2];
                if (objectId != 0xffffffff) {
                    const nx = wasm.float32(normals[buffOffs * 2 + 0]);
                    const ny = wasm.float32(normals[buffOffs * 2 + 1]);
                    const depth = depths[buffOffs];
                    const [deviation16, intensity16] = new Uint16Array(infos.buffer, buffOffs * 8, 2);
                    const deviation = wasm.float32(deviation16);
                    const intensity = wasm.float32(intensity16);

                    // compute clip space x,y coords
                    const xCS = ((ix + 0.5) / width) * 2 - 1;
                    const yCS = ((iy + 0.5) / height) * 2 - 1;

                    // compute view space position and normal
                    const scale = isOrtho ? 1 : depth;
                    const posVS = vec3.fromValues((xCS / viewClipMatrix[0]) * scale, (yCS / viewClipMatrix[5]) * scale, -depth);
                    const nz = Math.sqrt(1 - (nx * nx + ny * ny));
                    const normalVS = vec3.fromValues(nx, ny, nz);

                    // convert into world space.
                    const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrix);
                    const normal = vec3.transformMat3(vec3.create(), normalVS, viewWorldMatrixNormal);
                    vec3.normalize(normal, normal);

                    const sample = { x: ix - px, y: iy - py, position, normal, objectId, deviation, intensity } as const;
                    samples.push(sample);
                }
            }
        }
        return samples;
    }
}

export interface PickSample {
    // relative x/y pixel (not css pixel) coordinate from pick center.
    readonly x: number;
    readonly y: number;
    // position and normals are in world space.
    readonly position: ReadonlyVec3;
    readonly normal: ReadonlyVec3;
    readonly objectId: number;
    readonly deviation: number;
    readonly intensity: number;
};
