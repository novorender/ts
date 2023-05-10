import { CoordSpace, TonemappingMode, createDefaultModules } from "./";
import type { RenderModuleContext, RenderModule, DerivedRenderState, RenderState } from "./";
import { glCreateBuffer, glExtensions, glState, glUpdateBuffer, glUBOProxy, glCheckProgram, glCreateTimer, glClear, type StateParams, glLimits, } from "@novorender/webgl2";
import type { UniformsProxy, TextureParamsCubeUncompressedMipMapped, TextureParamsCubeUncompressed, ColorAttachment, ShaderHeaderParams, Timer, DrawStatistics } from "@novorender/webgl2";
import { matricesFromRenderState } from "./matrices";
import { createViewFrustum } from "./viewFrustum";
import { BufferFlags, RenderBuffers } from "./buffers";
import type { WasmInstance } from "./wasm";
import type { ReadonlyVec3 } from "gl-matrix";
import { mat3, mat4, vec3, vec4 } from "gl-matrix";
import commonShaderCore from "./common.glsl";
import { ResourceBin } from "./resource";
import type { DeviceProfile } from "./device";
import { othoNormalBasisMatrixFromPlane } from "./util";

// the context is re-created from scratch if the underlying webgl2 context is lost
export class RenderContext {
    private static defaultModules: readonly RenderModule[] | undefined;
    private modules: readonly RenderModuleContext[] | undefined;
    private cameraUniformsData;
    private clippingUniformsData;
    private outlinesUniformsData;
    protected localSpaceTranslation = vec3.create() as ReadonlyVec3;
    private readonly asyncPrograms: AsyncProgramInfo[] = [];
    readonly gl: WebGL2RenderingContext;
    readonly commonChunk: string;
    readonly defaultIBLTextureParams: TextureParamsCubeUncompressed;
    private readonly resourceBins = new Set<ResourceBin>();
    private readonly defaultResourceBin;
    private readonly iblResourceBin;
    private pickBuffersValid = false;
    private activeTimers = new Set<Timer>();
    private currentFrameTime = 0;
    private statistics = {
        points: 0,
        lines: 0,
        triangles: 0,
        drawCalls: 0,
    };
    private prevFrame: {
        readonly time: number;
        readonly resolve: (interval: number) => void;
    } | undefined;

    // use a pre-pass to fill in z-buffer for improved fill rate at the expense of triangle rate (useful when doing heavy shading, but unclear how efficient this is on tiled GPUs.)
    //* @internal */
    readonly usePrepass = false;

    // copy from last rendered state
    private isOrtho = false;
    private viewClipMatrix = mat4.create();
    private viewWorldMatrix = mat4.create();
    private viewWorldMatrixNormal = mat3.create();

    // constant gl resources
    readonly cameraUniforms: WebGLBuffer;
    readonly clippingUniforms: WebGLBuffer;
    readonly outlineUniforms: WebGLBuffer;
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
        readonly default: boolean;
    };
    isIdleFrame = false;


    constructor(readonly deviceProfile: DeviceProfile, readonly canvas: HTMLCanvasElement, readonly wasm: WasmInstance, lut_ggx: TexImageSource, options?: WebGLContextAttributes) {
        // init gl context
        const gl = canvas.getContext("webgl2", options);
        if (!gl)
            throw new Error("Unable to create WebGL 2 context!");
        this.gl = gl;
        const extensions = glExtensions(gl, true);
        const defaultBin = this.defaultResourceBin = this.resourceBin("context");
        const iblBin = this.iblResourceBin = this.resourceBin("ibl");
        console.assert(extensions.loseContext != null, extensions.multiDraw != null, extensions.colorBufferFloat != null);
        const { provokingVertex } = extensions;
        if (provokingVertex) {
            provokingVertex.provokingVertexWEBGL(provokingVertex.FIRST_VERTEX_CONVENTION_WEBGL);
        }
        this.commonChunk = commonShaderCore;

        // ggx lookup texture and ibl samplers
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        const lutParams = { kind: "TEXTURE_2D", internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: lut_ggx } as const;
        this.lut_ggx = defaultBin.createTexture(lutParams);
        this.samplerSingle = defaultBin.createSampler({ minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        this.samplerMip = defaultBin.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });

        // create default ibl textures
        const top = new Uint8Array([192, 192, 192, 255]);
        const side = new Uint8Array([128, 128, 128, 255]);
        const bottom = new Uint8Array([64, 64, 64, 255]);
        const image = [side, side, top, bottom, side, side] as const;
        const textureParams = this.defaultIBLTextureParams = { kind: "TEXTURE_CUBE_MAP", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: image } as const;
        this.iblTextures = {
            diffuse: iblBin.createTexture(textureParams),
            specular: iblBin.createTexture(textureParams),
            numMipMaps: 1,
            default: true,
        };

        // camera uniforms
        this.cameraUniformsData = glUBOProxy({
            clipViewMatrix: "mat4",
            viewClipMatrix: "mat4",
            localViewMatrix: "mat4",
            viewLocalMatrix: "mat4",
            localViewMatrixNormal: "mat3",
            viewLocalMatrixNormal: "mat3",
            windowSize: "vec2",
            near: "float",
        });
        this.cameraUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.cameraUniformsData.buffer.byteLength });

        // clipping uniforms
        this.clippingUniformsData = glUBOProxy({
            "planes.0": "vec4",
            "planes.1": "vec4",
            "planes.2": "vec4",
            "planes.3": "vec4",
            "planes.4": "vec4",
            "planes.5": "vec4",
            numPlanes: "uint",
            mode: "uint",
        });
        this.clippingUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.clippingUniformsData.buffer.byteLength });

        // outlines uniforms
        this.outlinesUniformsData = glUBOProxy({
            localPlaneMatrix: "mat4",
            planeLocalMatrix: "mat4",
            color: "vec3",
        });
        this.outlineUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.outlinesUniformsData.buffer.byteLength });
    }

    async init(modules?: readonly RenderModule[]) {
        // initialize modules
        if (!modules) {
            RenderContext.defaultModules ??= createDefaultModules();
            modules = RenderContext.defaultModules;
        }
        const modulePromises = modules.map((m, i) => {
            const ret = m.withContext(this);
            return isPromise(ret) ? ret : Promise.resolve(ret);
        });
        // link all programs here (this is supposedly faster than interleaving compiles and links)
        const { gl, asyncPrograms } = this;
        for (const { program } of this.asyncPrograms) {
            gl.linkProgram(program);
        }
        gl.useProgram(null);

        // wait for completion
        const ext = glExtensions(gl).parallelShaderCompile;
        function pollAsyncPrograms() {
            for (let i = 0; i < asyncPrograms.length; i++) {
                const { program, resolve, reject } = asyncPrograms[i];
                if (ext) {
                    if (!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR))
                        continue;
                }
                const [info] = asyncPrograms.splice(i--, 1);
                const error = glCheckProgram(gl, info);
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            }
            if (asyncPrograms.length > 0) {
                setTimeout(pollAsyncPrograms);
            }
        }
        pollAsyncPrograms();
        this.modules = await Promise.all(modulePromises);
    }

    dispose() {
        const { buffers, modules, activeTimers, defaultResourceBin, iblResourceBin } = this;
        this.poll(); // finish async stuff
        for (const timer of activeTimers) {
            timer.dispose();
        }
        activeTimers.clear();
        if (modules) {
            for (const module of modules) {
                module?.dispose();
            }
            this.modules = undefined;
        }
        buffers?.dispose();
        iblResourceBin.dispose();
        defaultResourceBin.dispose();
        console.assert(this.resourceBins.size == 0);
    }

    get width() {
        return this.gl.drawingBufferWidth;
    }

    get height() {
        return this.gl.drawingBufferHeight;
    }

    isContextLost() {
        return this.gl.isContextLost();
    }

    //* @internal */
    drawBuffers(buffers: BufferFlags = (BufferFlags.all)): readonly (ColorAttachment | "NONE")[] {
        const activeBuffers = buffers; // & this.drawBuffersMask;
        return [
            activeBuffers & BufferFlags.color ? "COLOR_ATTACHMENT0" : "NONE",
            activeBuffers & BufferFlags.pick ? "COLOR_ATTACHMENT1" : "NONE",
        ] as const;
    }

    //* @internal */
    updateUniformBuffer(uniformBuffer: WebGLBuffer, proxy: UniformsProxy) {
        if (!proxy.dirtyRange.isEmpty) {
            const { begin, end } = proxy.dirtyRange;
            glUpdateBuffer(this.gl, { kind: "UNIFORM_BUFFER", srcData: proxy.buffer, targetBuffer: uniformBuffer, srcElementOffset: begin, dstByteOffset: begin, byteSize: end - begin });
            proxy.dirtyRange.clear();
        }
    }

    //* @internal */
    updateIBLTextures(params: { readonly diffuse: TextureParamsCubeUncompressed, readonly specular: TextureParamsCubeUncompressedMipMapped } | null) {
        const { iblResourceBin } = this;
        iblResourceBin.deleteAll();
        if (params) {
            const { diffuse, specular } = params;
            this.iblTextures = {
                diffuse: iblResourceBin.createTexture(diffuse),
                specular: iblResourceBin.createTexture(specular),
                numMipMaps: typeof specular.mipMaps == "number" ? specular.mipMaps : specular.mipMaps.length,
                default: false,
            };
        } else {
            this.iblTextures = {
                diffuse: iblResourceBin.createTexture(this.defaultIBLTextureParams),
                specular: iblResourceBin.createTexture(this.defaultIBLTextureParams),
                numMipMaps: 1,
                default: false,
            };
        }
    }

    //* @internal */
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

    //* @internal */
    resourceBin(name: string) {
        return ResourceBin["create"](this.gl, name, this.resourceBins);
    }

    //* @internal */
    makeProgramAsync(resourceBin: ResourceBin, params: AsyncProgramParams) {
        const { gl, commonChunk } = this;
        const { vertexShader, fragmentShader } = params;
        const header = { commonChunk, ...params.header } as const; // inject common shader code here, if not defined in params.
        const programAsync = resourceBin.createProgramAsync({ header, vertexShader, fragmentShader });
        const { program } = programAsync;

        // do pre-link bindings here
        const { attributes, transformFeedback, uniformBufferBlocks, textureUniforms } = params;
        if (attributes) {
            let i = 0;
            for (const name of attributes) {
                gl.bindAttribLocation(program, i++, name);
            }
        }
        if (transformFeedback) {
            const { varyings, bufferMode } = transformFeedback;
            gl.transformFeedbackVaryings(program, varyings, gl[bufferMode]);
        }

        return new Promise<WebGLProgram>((resolve, reject) => {
            // do post-link bindings here
            function postLink() {
                gl.useProgram(program);

                if (uniformBufferBlocks) {
                    let idx = 0;
                    for (const name of uniformBufferBlocks) {
                        if (name) {
                            const blockIndex = gl.getUniformBlockIndex(program, name);
                            if (blockIndex != gl.INVALID_INDEX) {
                                gl.uniformBlockBinding(program, blockIndex, idx);
                            } else {
                                console.warn(`Shader has no uniform block named: ${name}!`);
                            }
                        }
                        idx++;
                    }
                }

                if (textureUniforms) {
                    let i = 0;
                    for (const name of textureUniforms) {
                        const location = gl.getUniformLocation(program, name);
                        gl.uniform1i(location, i++);
                    }
                }

                gl.useProgram(null);
                resolve(program);
            }
            this.asyncPrograms.push({ ...programAsync, resolve: postLink, reject });
        });
    }

    private resetRenderStatistics() {
        const { statistics } = this;
        statistics.points = 0;
        statistics.lines = 0;
        statistics.triangles = 0;
        statistics.drawCalls = 0;
    }

    //* @internal */
    protected addRenderStatistics(stats: DrawStatistics, drawCalls = 1) {
        const { statistics } = this;
        statistics.points += stats.points;
        statistics.lines += stats.lines;
        statistics.triangles += stats.triangles;
        statistics.drawCalls += drawCalls;
    }

    //* @internal */
    protected contextLost() {
        const { modules } = this;
        if (modules) {
            for (const module of modules) {
                module?.contextLost();
            }
        }
    }

    //* @internal */
    emulateLostContext(value: "lose" | "restore") {
        const ext = glExtensions(this.gl).loseContext;
        if (ext) {
            if (value == "lose") {
                ext.loseContext();
            } else {
                ext.restoreContext();
            }
        }
    }

    public poll() {
        this.buffers?.pollPickFence();
        this.pollTimers();
    }

    private beginTimer(): Timer {
        const timer = glCreateTimer(this.gl, false);
        this.activeTimers.add(timer);
        timer.begin();
        return timer;
    }

    private pollTimers() {
        const { activeTimers } = this;
        for (const timer of [...activeTimers]) {
            if (timer.poll()) {
                activeTimers.delete(timer);
                timer.dispose();
            }
        }
    }

    public static nextFrame(context: RenderContext | undefined): Promise<number> {
        return new Promise<number>((resolve) => {
            requestAnimationFrame((time) => {
                if (context) {
                    const { prevFrame } = context;
                    if (prevFrame) {
                        prevFrame.resolve(time - prevFrame.time);
                        context.prevFrame = undefined;
                    }
                    context.currentFrameTime = time;
                }
                resolve(time);
            });
        });
    }

    public async render(state: RenderState) {
        if (!this.modules) {
            throw new Error("Context has not been initialized!");
        }
        const beginTime = performance.now();
        const { gl, canvas, prevState } = this;
        this.changed = false;
        this.pickBuffersValid = false;

        this.resetRenderStatistics();

        const drawTimer = this.beginTimer();

        const { MAX_SAMPLES } = glLimits(gl);
        const effectiveSamplesMSAA = Math.max(1, Math.min(MAX_SAMPLES, Math.min(this.deviceProfile.limits.maxSamples, state.output.samplesMSAA)));

        // handle resizes
        let resized = false;
        const { output } = state;
        if (this.hasStateChanged({ output })) {
            const { width, height } = output;
            console.assert(Number.isInteger(width) && Number.isInteger(height));
            canvas.width = width;
            canvas.height = height;
            resized = true;
            this.changed = true;
            this.buffers?.dispose();
            this.buffers = new RenderBuffers(gl, width, height, effectiveSamplesMSAA, this.resourceBin("FrameBuffers"));
        }

        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const derivedState = state as Mutable<DerivedRenderState>;
        derivedState.effectiveSamplesMSAA = effectiveSamplesMSAA;
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
        this.updateClippingUniforms(derivedState);
        this.updateOutlinesUniforms(derivedState);

        // update internal state
        this.isOrtho = derivedState.camera.kind == "orthographic";
        mat4.copy(this.viewClipMatrix, derivedState.matrices.getMatrix(CoordSpace.View, CoordSpace.Clip));
        mat4.copy(this.viewWorldMatrix, derivedState.matrices.getMatrix(CoordSpace.View, CoordSpace.World));
        mat3.copy(this.viewWorldMatrixNormal, derivedState.matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World));

        // update modules from state
        for (const module of this.modules) {
            module?.update(derivedState);
        }

        // pick frame buffer and clear z-buffer
        const { width, height } = canvas;
        const { buffers } = this;
        buffers.readBuffersNeedUpdate = true;
        const frameBufferName = effectiveSamplesMSAA > 1 ? "colorMSAA" : "color";
        const frameBuffer = buffers.frameBuffers[frameBufferName];
        buffers.invalidate(frameBufferName, BufferFlags.all);
        glState(gl, { viewport: { width, height }, frameBuffer });
        glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });

        // apply module render z-buffer pre-pass
        if (this.usePrepass) {
            for (const module of this.modules) {
                if (module && module.prepass) {
                    glState(gl, {
                        viewport: { width, height },
                        frameBuffer,
                        drawBuffers: [],
                        // colorMask: [false, false, false, false],
                    });
                    module.prepass(derivedState);
                    // reset gl state
                    glState(gl, null);
                }
            }
        }

        // render modules
        for (const module of this.modules) {
            if (module) {
                glState(gl, {
                    viewport: { width, height },
                    frameBuffer,
                    drawBuffers: this.drawBuffers(BufferFlags.color),
                    sample: { alphaToCoverage: effectiveSamplesMSAA > 1 },
                });
                module.render(derivedState);
                // reset gl state
                glState(gl, null);
            }
        }

        drawTimer.end();

        // invalidate color and depth buffers only (we may need pick buffers for picking)
        this.buffers.invalidate("colorMSAA", BufferFlags.color | BufferFlags.depth);
        this.buffers.invalidate("color", BufferFlags.color | BufferFlags.depth);
        this.prevState = derivedState;
        const endTime = performance.now();

        const intervalPromise = new Promise<number>((resolve) => {
            this.prevFrame = { time: this.currentFrameTime, resolve };
        });

        const stats = { ...this.statistics, bufferBytes: 0, textureBytes: 0 };
        for (const bin of this.resourceBins) {
            for (const { kind, byteSize } of bin.resourceInfo) {
                if (kind == "Buffer" || kind == "Renderbuffer") {
                    stats.bufferBytes += byteSize!;
                }
                if (kind == "Texture") {
                    stats.textureBytes += byteSize!;
                }
            }
        }

        const [gpuDrawTime, frameInterval] = await Promise.all([drawTimer.promise, intervalPromise]);

        return {
            cpuTime: {
                draw: endTime - beginTime,
            },
            gpuTime: {
                draw: gpuDrawTime,
            },
            frameInterval,
            ...stats
        } as const;
    }

    //* @internal */
    renderPickBuffers() {
        if (!this.pickBuffersValid) {
            if (!this.modules) {
                throw new Error("Context has not been initialized!");
            }
            const { gl, width, height, buffers, prevState } = this;
            if (!prevState) {
                throw new Error("render() was not called!"); // we assume render() has been called first
            }

            const stateParams: StateParams = {
                viewport: { width, height },
                frameBuffer: buffers.frameBuffers.pick,
                drawBuffers: this.drawBuffers(BufferFlags.pick),
                depth: { test: true, writeMask: true },
            };
            glState(gl, stateParams);
            glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 }); // we need to clear (again) since depth might be different for pick and color renders and we're also not using MSAA depth buffer.
            // glClear(gl, { kind: "COLOR", drawBuffer: 1, type: "Float", color: [Number.POSITIVE_INFINITY, 0, 0, 0] });
            glClear(gl, { kind: "COLOR", drawBuffer: 1, type: "Uint", color: [0xffffffff, 0x0000_0000, 0x0000_0000, 0x7f80_0000] }); // 0xffff is bit-encoding for Float16.nan. (https://en.wikipedia.org/wiki/Half-precision_floating-point_format), 0x7f80_0000 is Float32.+inf

            for (const module of this.modules) {
                if (module) {
                    glState(gl, stateParams);
                    module.pick?.(prevState);
                    // reset gl state
                    glState(gl, null);
                }
            }

            if (prevState.tonemapping.mode != TonemappingMode.color) {
                // update debug display
                const tonemapModule = this.modules?.find(m => m.module.kind == "tonemap");
                glState(gl, { viewport: { width, height } });
                tonemapModule?.render(prevState);
                // reset gl state
                glState(gl, null);
            }

            this.pickBuffersValid = true;
        }
    }

    //* @internal */
    *getLinearDepths(pick: Uint32Array): IterableIterator<number> {
        const floats = new Float32Array(pick.buffer);
        for (let i = 3; i < pick.length; i += 4) {
            yield floats[i];
        }
    }

    private updateCameraUniforms(state: DerivedRenderState) {
        const { cameraUniformsData, localSpaceTranslation } = this;
        const { output, camera, matrices } = state;
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
        values.localViewMatrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
        values.viewLocalMatrixNormal = matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World);
        values.windowSize = [output.width, output.height];
        values.near = camera.near;
        this.updateUniformBuffer(this.cameraUniforms, this.cameraUniformsData);
    }

    private updateClippingUniforms(state: DerivedRenderState) {
        const { clipping, matrices } = state;
        if (this.hasStateChanged({ clipping, matrices })) {
            const { clippingUniforms, clippingUniformsData } = this;
            const { values } = clippingUniformsData;
            const { enabled, mode, planes } = clipping;
            // transform clipping planes into view space
            const normal = vec3.create();
            const position = vec3.create();
            const matrix = matrices.getMatrix(CoordSpace.World, CoordSpace.View);
            const matrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
            mat4.getTranslation(position, matrix);
            for (let i = 0; i < planes.length; i++) {
                const { normalOffset } = planes[i];
                const [x, y, z, offset] = normalOffset;
                vec3.set(normal, x, y, z);
                vec3.transformMat3(normal, normal, matrixNormal);
                const distance = offset + vec3.dot(position, normal);
                const plane = vec4.fromValues(normal[0], normal[1], normal[2], -distance);
                const idx = i as 0 | 1 | 2 | 3 | 4 | 5;
                values[`planes.${idx}` as const] = plane;
            }
            values["numPlanes"] = enabled ? planes.length : 0;
            values["mode"] = mode;
            this.updateUniformBuffer(clippingUniforms, clippingUniformsData);
        }
    }

    private updateOutlinesUniforms(state: DerivedRenderState) {
        const { outlines, matrices } = state;
        if (this.hasStateChanged({ outlines, matrices })) {
            const { outlineUniforms, outlinesUniformsData } = this;
            const { color, plane } = outlines;
            // transform outline plane into local space
            const [x, y, z, offset] = plane;
            const normal = vec3.fromValues(x, y, z);
            const distance = offset - vec3.dot(this.localSpaceTranslation, normal);
            const margin = 0.001; // add a tiny margin so that these lines aren't clipped by the clipping plane itself
            const planeLS = vec4.fromValues(normal[0], normal[1], normal[2], -distance - margin);
            // compute plane projection matrices
            const localPlaneMatrix = othoNormalBasisMatrixFromPlane(planeLS);
            const planeLocalMatrix = mat4.invert(mat4.create(), localPlaneMatrix);
            // set uniform values
            const { values } = outlinesUniformsData;
            values.planeLocalMatrix = planeLocalMatrix;
            values.localPlaneMatrix = localPlaneMatrix;
            values.color = color;
            this.updateUniformBuffer(outlineUniforms, outlinesUniformsData);
        }
    }

    async pick(x: number, y: number, sampleDiscRadius = 0): Promise<PickSample[]> {
        if (sampleDiscRadius < 0)
            return [];
        this.renderPickBuffers();
        const { canvas, wasm, buffers, width, height } = this;
        const rect = canvas.getBoundingClientRect(); // dim in css pixels
        const cssWidth = rect.width;
        const cssHeight = rect.height;
        // convert to pixel coords
        const px = Math.round(x / cssWidth * width);
        const py = Math.round((1 - (y + 0.5) / cssHeight) * height);
        console.assert(px >= 0 && py >= 0 && px < width && py < height);
        const { pick } = await buffers.pickBuffers();
        const floats = new Float32Array(pick.buffer);

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
                const objectId = pick[buffOffs * 4];
                if (objectId != 0xffffffff) {
                    const depth = floats[buffOffs * 4 + 3];
                    const [nx16, ny16, nz16, deviation16] = new Uint16Array(pick.buffer, buffOffs * 16 + 4, 4);
                    const nx = wasm.float32(nx16);
                    const ny = wasm.float32(ny16);
                    const nz = wasm.float32(nz16);
                    const deviation = wasm.float32(deviation16);

                    // compute normal
                    // compute clip space x,y coords
                    const xCS = ((ix + 0.5) / width) * 2 - 1;
                    const yCS = ((iy + 0.5) / height) * 2 - 1;

                    // compute view space position and normal
                    const scale = isOrtho ? 1 : depth;
                    const posVS = vec3.fromValues((xCS / viewClipMatrix[0]) * scale, (yCS / viewClipMatrix[5]) * scale, -depth);

                    // convert into world space.
                    const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrix);
                    // const normal = vec3.transformMat3(vec3.create(), normalVS, viewWorldMatrixNormal);
                    const normal = vec3.fromValues(nx, ny, nz);
                    vec3.normalize(normal, normal);

                    const sample = { x: ix - px, y: iy - py, position, normal, objectId, deviation, depth } as const;
                    samples.push(sample);
                }
            }
        }
        return samples;
    }
}

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
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
    readonly depth: number;
};

export interface AsyncProgramParams {
    readonly header?: Partial<ShaderHeaderParams>;
    readonly vertexShader: string;
    readonly fragmentShader?: string;
    // pre-link bindings
    readonly attributes?: readonly string[]; // The names of the vertex attributes to be bound using gl.bindAttribLocation().
    readonly uniformBufferBlocks?: readonly string[]; // The names of the shader uniform blocks, which will be bound to the index in which the name appears in this array using gl.uniformBlockBinding().
    // post-link bindings
    readonly textureUniforms?: readonly string[]; // Texture uniforms will be bound to the index in which they appear in the name array.
    readonly transformFeedback?: {
        readonly bufferMode: "INTERLEAVED_ATTRIBS" | "SEPARATE_ATTRIBS";
        readonly varyings: readonly string[];
    };
}

interface AsyncProgramInfo {
    readonly program: WebGLProgram;
    readonly vertex: WebGLShader;
    readonly fragment: WebGLShader;
    readonly resolve: () => void;
    readonly reject: (reason: any) => void;
}

export type RenderStatistics = Awaited<ReturnType<RenderContext["render"]>>;