import { RenderModuleContext, RenderModule, RenderStateOutput, DerivedRenderState, RenderState, RenderStateCamera, CoordSpace, createDefaultModules } from "./";
import { glBuffer, glExtensions, glState, glUpdateBuffer, createUniformsProxy, UniformsProxy } from "webgl2";
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

    readonly cameraUniforms: WebGLBuffer;

    // shared mutable state
    prevState: DerivedRenderState | undefined;
    changed = true; // flag to force a re-render when internal render module state has changed, e.g. on download complete.
    buffers: RenderBuffers = undefined!; // output render buffers
    iblTextures: { // these are set by the background module, once download is complete
        readonly lut_ggx: WebGLTexture; // 2D lookup texture for ggx function.
        readonly diffuse: WebGLTexture; // irradiance, mipped cubemap
        readonly specular: WebGLTexture; // radiance, no-mip cubemap
        readonly skybox: WebGLTexture; // high-res background panorama image cubemap.
        readonly samplerMip: WebGLSampler; // use to read diffuse texture
        readonly samplerSingle: WebGLSampler; // use to read the other textures
        readonly numMipMaps: number; // # of diffuse mip map levels.
    } | undefined;
    clippingUniforms: WebGLBuffer | undefined;

    constructor(readonly canvas: HTMLCanvasElement, readonly wasm: WasmInstance, options?: WebGLContextAttributes, modules?: readonly RenderModule[]) {
        const gl = canvas.getContext("webgl2", options);
        if (!gl)
            throw new Error("Unable to create WebGL 2 context!");
        this.gl = gl;
        const extensions = glExtensions(gl, true);
        console.assert(extensions.loseContext != null, extensions.multiDraw != null, extensions.colorBufferFloat != null);

        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

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

    dispose() {
        const { gl, cameraUniforms, buffers, moduleContexts } = this;
        gl.deleteBuffer(cameraUniforms);
        buffers?.dispose();
        for (const module of moduleContexts) {
            module?.dispose();
        }
        this.deletePick();
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
        this.pollPick();
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

    pickInfo: {
        readonly sync: WebGLSync,
        readonly promises: { readonly resolve: () => void, readonly reject: (reason: string) => void }[],
    } | undefined;

    private pollPick() {
        const { gl, pickInfo } = this;
        if (pickInfo) {
            const { sync, promises } = pickInfo;
            const status = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
            if (status == gl.WAIT_FAILED) {
                for (const promise of promises) {
                    promise.reject("Pick failed!");
                }
                this.deletePick();
            } else if (status != gl.TIMEOUT_EXPIRED) {
                for (const promise of promises) {
                    promise.resolve();
                }
                this.deletePick();
            }
        }
    }

    private deletePick() {
        this.gl.deleteSync(this.pickInfo?.sync ?? null);
        this.pickInfo = undefined;
    }

    protected async pick(x: number, y: number) {
        const { gl, canvas, wasm, buffers, width, height } = this;
        const { resources } = buffers;
        const r = canvas.getBoundingClientRect(); // dim in css pixels
        const cssWidth = r.width;
        const cssHeight = r.height;
        // convert to pixel coords
        const px = Math.round(x / cssWidth * width);
        const py = Math.round((1 - (y + 0.5) / cssHeight) * height);
        console.assert(px >= 0 && py >= 0 && px < width && py < height);
        if (!this.pickInfo) {
            buffers.read();
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
            this.pickInfo = { sync, promises: [] };
        }
        const { promises } = this.pickInfo;
        const promise = new Promise<void>((resolve, reject) => {
            promises.push({ resolve, reject });
        });
        await promise;

        const pixOffs = px + py * width;
        const floats = new Float32Array(3);
        const uints = new Uint32Array(2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readNormal);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 4, floats, 0, 2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readLinearDepth);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 4, floats, 2, 1);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readInfo);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 8, uints, 0, 2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        const [nx, ny, depth] = floats;
        const [objectId] = uints;
        if (objectId == 0xffffffff) {
            return undefined;
        }
        const [deviation16, intensity16] = new Uint16Array(uints.buffer, 4);
        const deviation = wasm.float32(deviation16);
        const intensity = wasm.float32(intensity16);

        // compute clip space x,y coords
        const xCS = ((x + 0.5) / width) * 2 - 1;
        const yCS = ((y + 0.5) / height) * 2 - 1;

        // compute view space position and normal
        const scale = this.isOrtho ? 1 : depth;
        const posVS = vec3.fromValues((xCS / this.viewClipMatrix[0]) * scale, (yCS / this.viewClipMatrix[5]) * scale, -depth);
        const nz = Math.sqrt(1 - (nx * nx + ny * ny));
        const normalVS = vec3.fromValues(nx, ny, nz);

        // convert into world space.
        const position = vec3.transformMat4(vec3.create(), posVS, this.viewWorldMatrix);
        const normal = vec3.transformMat3(vec3.create(), normalVS, this.viewWorldMatrixNormal);
        vec3.normalize(normal, normal);

        return { position, normal, objectId, deviation, intensity } as const;
    }
}

