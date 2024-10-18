import { CoordSpace, TonemappingMode, type RGB, getMaterialCommon } from "./";
import type { RenderModuleContext, RenderModule, DerivedRenderState, RenderState, Core3DImports, RenderStateOutlines, PBRMaterialInfo, PBRMaterialCommon } from "./";
import { glCreateBuffer, glExtensions, glState, glUpdateBuffer, glUBOProxy, glCheckProgram, glCreateTimer, glClear, type StateParams, glLimits } from "webgl2";
import type { UniformsProxy, TextureParamsCubeUncompressedMipMapped, TextureParamsCubeUncompressed, ColorAttachment, ShaderHeaderParams, Timer, DrawStatistics } from "webgl2";
import { matricesFromRenderState } from "./matrices";
import { createViewFrustum } from "./viewFrustum";
import { BufferFlags, RenderBuffers } from "./buffers";
import type { WasmInstance } from "./wasm";
import type { ReadonlyVec2, ReadonlyVec3, ReadonlyVec4 } from "gl-matrix";
import { glMatrix, mat3, mat4, quat, vec2, vec3, vec4 } from "gl-matrix";
import { ResourceBin } from "./resource";
import type { DeviceProfile } from "./device";
import { orthoNormalBasisMatrixFromPlane } from "./util";
import { createDefaultModules } from "./modules/default";
import type { OutlineRenderer } from "./modules/octree/outlines";

// the context is re-created from scratch if the underlying webgl2 context is lost

/** The view specific context for rendering and picking.
 * @remarks
 * A render context describes a view into which a {@link RenderState} can be rendered.
 * It is tightly bound to a HTML canvas and WebGL2RenderingContext.
 * Consequently, it will be disposed if the gl context is lost and recreated when the gl context is restored.
 * 
 * The render context must be {@link init | initialized} with an array of {@link RenderModule | render modules}.
 * Unused modules may be removed and custom ones inserted here.
 * Ordering the modules correctly is important as they are rendered in order.
 * The {@link TonemapModule} should be last, as it will copy the HDR render buffers into the output canvas to make things visible.
 * 
 * Features such as async picking and shader linking requires {@link poll} to be called at regular intervals,
 * e.g. at the start of each frame.
 * Otherwise the promises will never be resolved.
 * 
 * @category Render Module
 */
export class RenderContext {
    /** WebGL2 render context associated with this object. */
    readonly gl: WebGL2RenderingContext;
    /** WebGL common GLSL code header used across shaders. */
    readonly commonChunk: string;
    /** WebGL basic fallback IBL textures to use while loading proper IBL textures. */
    readonly defaultIBLTextureParams: TextureParamsCubeUncompressed;
    /** Web assembly instance. */
    readonly wasm: WasmInstance;

    private static defaultModules: readonly RenderModule[] | undefined;
    private modules: readonly RenderModuleContext[] | undefined;
    private cameraUniformsData;
    private clippingUniformsData;
    private outlinesUniformsData;
    private localSpaceTranslation = vec3.create() as ReadonlyVec3;
    private readonly asyncPrograms: AsyncProgramInfo[] = [];
    private readonly resourceBins = new Set<ResourceBin>();
    private readonly defaultResourceBin;
    private readonly iblResourceBin;
    private pickBuffersValid = false;
    private currentPick: Uint32Array | undefined;
    private activeTimers = new Set<Timer>();
    private currentFrameTime = 0;
    private statistics = {
        points: 0,
        lines: 0,
        triangles: 0,
        drawCalls: 0,
        primitives: 0,
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

    private viewClipMatrixLastPoll = mat4.create();
    private viewWorldMatrixLastPoll = mat4.create();

    // constant gl resources
    /** WebGL uniform buffer for camera related uniforms. */
    readonly cameraUniforms: WebGLBuffer;
    /** WebGL uniform buffer for clipping related uniforms. */
    readonly clippingUniforms: WebGLBuffer;
    /** WebGL uniform buffer for outline related uniforms. */
    readonly outlineUniforms: WebGLBuffer;
    /** WebGL GGX/PBR shading lookup table texture. */
    readonly lut_ggx: WebGLTexture;
    /** WebGL Sampler used to sample mip mapped IBL texture trilinear. */
    readonly samplerEnvMip: WebGLSampler; // use for trilinear sampling with capped lower mip (due to WebGL bug?)
    /** WebGL Sampler used to sample mipmapped texture trilinear. */
    readonly samplerMip: WebGLSampler; // use for trilinear sampling
    /** WebGL Sampler used to sample mipmapped texture trilinear repeating UV. */
    readonly samplerMipRepeat: WebGLSampler;
    /** WebGL Sampler used to sample other, non-mipmapped IBL textures bilinear. */
    readonly samplerSingle: WebGLSampler; // use to read the other textures

    /** @internal */
    readonly materialCommon: PBRMaterialCommon | undefined;
    /** @internal Use to map textures to local disk - for internal debugging and testing only! */
    materialFiles: Map<string, File> | undefined;

    outlineRenderers = new WeakMap<ReadonlyVec4, OutlineRenderer>();

    private polygonMode;

    // shared mutable state
    /** {@link RenderState} used to render the previous frame, if any. */
    prevState: DerivedRenderState | undefined;

    // shared mutable state
    /** {@link RenderState} used to make the newest state available during render. */
    currentState: DerivedRenderState | undefined;

    /** Set to true to force a re-render when state not contained in {@link RenderState} has changed, e.g. download complete etc. */
    changed = true;
    /** @internal */
    pause = false; // true to freeze all module updates, e.g. downloading of new geometry etc.
    /** WebGL render and pick buffers
     * @remarks
     * Note that these buffers will be recreated whenever the {@link RenderState.output} size changes.
     */
    buffers: RenderBuffers = undefined!;

    /** WebGL textures used for image based lighting ({@link https://en.wikipedia.org/wiki/Image-based_lighting | IBL}).
     * @remarks
     * Note that these buffers will be changed by the background module when download of the specified {@link RenderState.background.url} IBL textures completes.
     * 
     * The process to create the textures are similar to that of {@link https://github.com/KhronosGroup/glTF-IBL-Sampler}/
     */
    iblTextures: { // these are changed by the background module, once download is complete
        /** WebGL cubemap texture containing the irradiance/diffuse values of current IBL environment. */
        readonly diffuse: WebGLTexture;
        /** WebGL cubemap texture containing the radiance/specular values of current IBL environment. */
        readonly specular: WebGLTexture;
        /** # mip maps in current specular texture. */
        readonly numMipMaps: number;
        /** # True if these are the default IBL textures. */
        readonly default: boolean;
    };

    /** @internal */
    constructor(
        /** The device profile use for this context. */
        readonly deviceProfile: DeviceProfile,
        /** The HTML canvas used for this context. */
        readonly canvas: HTMLCanvasElement,
        /** Imported resources. */
        readonly imports: Core3DImports,
        webGLOptions?: WebGLContextAttributes,
    ) {
        this.materialCommon = getMaterialCommon(deviceProfile);

        // init gl context
        const gl = canvas.getContext("webgl2", webGLOptions);
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
        this.polygonMode = extensions.polygonMode;
        this.commonChunk = imports.shaders.common;
        this.wasm = imports.wasmInstance;

        // ggx lookup texture and ibl samplers
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        const lutParams = { kind: "TEXTURE_2D", internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: imports.lutGGX, generateMipMaps: true } as const;
        this.lut_ggx = defaultBin.createTexture(lutParams);
        this.samplerSingle = defaultBin.createSampler({ minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        this.samplerMip = defaultBin.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        this.samplerMipRepeat = defaultBin.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["REPEAT", "REPEAT"] });
        this.samplerEnvMip = defaultBin.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"], maxLOD: 5 });

        // create default ibl textures
        const top = new Uint8Array([192, 192, 192, 255]);
        const side = new Uint8Array([128, 128, 128, 255]);
        const bottom = new Uint8Array([64, 64, 64, 255]);
        const image = [side, side, top, bottom, side, side] as const;
        const textureParams = this.defaultIBLTextureParams = { kind: "TEXTURE_CUBE_MAP", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: image } as const;
        // const top = new Float32Array([.75, .75, .75, 1]);
        // const side = new Float32Array([.5, .5, .5, 1]);
        // const bottom = new Float32Array([.25, .25, .25, 1]);
        // const image = [side, side, top, bottom, side, side] as const;
        // const textureParams = this.defaultIBLTextureParams = { kind: "TEXTURE_CUBE_MAP", width: 1, height: 1, internalFormat: "RGBA32F", type: "FLOAT", image: image } as const;
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
            localBackgroundMatrixNormal: "mat3",
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
            lineColor: "vec3",
            planeIndex: "int",
            pointColor: "vec3",
            linearSize: "float",
            minPixelSize: "float",
            maxPixelSize: "float",
            pointScale: "float",
            pointObjectIdBase: "uint",
        });
        this.outlineUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.outlinesUniformsData.buffer.byteLength });
    }

    /** Initialize render context with specified render modules.
     * @remarks
     * The default/built-in render modules can be retrieved using {@link createDefaultModules}.
     * These will be used if no modules are specified.
     * Developers may introduce their own render modules here.
     * Note that the order of the modules matters, as this is the order by which they will be rendered.
     */
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
        this.linkAsyncPrograms();
        this.modules = await Promise.all(modulePromises);
    }

    private linkAsyncPrograms() {
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
                const { name, program, resolve, reject } = asyncPrograms[i];
                if (ext) {
                    if (!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR))
                        continue;
                }
                const [info] = asyncPrograms.splice(i--, 1);
                const error = glCheckProgram(gl, info);
                if (error) {
                    console.error(`Failed to link shader: ${name}!`);
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
    }

    /**
     * Dispose of the GPU resources used by this context, effectively destroying it and freeing up memory.
     * @remarks
     * Calling this method is optional as the garbage collection of the underlying WebGL render context will do the same thing.
     * This may take some time, however, so calling this function is recommended if you plan to create a new context shortly thereafter.
     */
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

    /** Return the current pixel width of the drawing buffer. */
    get width() {
        return this.gl.drawingBufferWidth;
    }

    /** Return the current pixel height of the drawing buffer. */
    get height() {
        return this.gl.drawingBufferHeight;
    }

    /** Query if pick buffers are valid.
     * @remarks This could be useful for optimistic/non-async picking.
     */
    isPickBuffersValid() {
        return this.pickBuffersValid;
    }

    /** Query whether the underlying WebGL render context is currently lost.
     * @remarks
     * This could occur when too many resources are allocated or when browser window is dragged across screens.
     * Loss and restoration of WebGL contexts is supported by this API automatically.
     */
    isContextLost() {
        return this.gl.isContextLost();
    }

    /** @internal */
    drawBuffers(buffers: BufferFlags = (BufferFlags.all)): readonly (ColorAttachment | "NONE")[] {
        const activeBuffers = buffers; // & this.drawBuffersMask;
        return [
            activeBuffers & BufferFlags.color ? "COLOR_ATTACHMENT0" : "NONE",
            activeBuffers & BufferFlags.pick ? "COLOR_ATTACHMENT1" : "NONE",
        ] as const;
    }

    /** Helper function to update WebGL uniform buffer from proxies. */
    updateUniformBuffer(uniformBuffer: WebGLBuffer, proxy: UniformsProxy) {
        if (!proxy.dirtyRange.isEmpty) {
            const { begin, end } = proxy.dirtyRange;
            glUpdateBuffer(this.gl, { kind: "UNIFORM_BUFFER", srcData: proxy.buffer, targetBuffer: uniformBuffer, srcElementOffset: begin, dstByteOffset: begin, byteSize: end - begin });
            proxy.dirtyRange.clear();
        }
    }

    /** Explicitly update WebGL IBL textures from specified parameters. */
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
                default: true,
            };
        }
    }

    /**
     * Helper function to check for changes in render state.
     * @param state The parts of the render state to check for changes.
     * @returns True if any of the specified parts has changed since last frame.
     * @remarks
     * Since the render state is immutable, any changes will automatically trickle up to the container object as well.
     * Thus, this function does a shallow strict equality of the parts of the renderstate specified in the state parameter.
     * @example
     * Example of how to check for changes in either camera or output render state.
     * ```typescript
     * const {camera, output} = renderState;
     * if(renderContext.hasStateChanged({camera, output})) {
     *   // update related GPU state here...
     * }
     * ```
     */
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

    /** Create a new named resource bin. */
    resourceBin(name: string) {
        return new ResourceBin(this.gl, name, this.resourceBins);
    }

    /** Compile WebGL/GLSL shader program asynchronously. */
    makeProgramAsync(resourceBin: ResourceBin, params: AsyncProgramParams) {
        const { gl, commonChunk } = this;
        const { name, vertexShader, fragmentShader } = params;
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
            this.asyncPrograms.push({ name, ...programAsync, resolve: postLink, reject });
        });
    }

    private resetGLState() {
        glState(this.gl, null);
        this.setPolygonFillMode("FILL");
    }

    private resetStatistics() {
        const { statistics } = this;
        statistics.points = 0;
        statistics.lines = 0;
        statistics.triangles = 0;
        statistics.drawCalls = 0;
        statistics.primitives = 0;
    }

    /** @internal */
    addRenderStatistics(stats: DrawStatistics, drawCalls = 1) {
        const { statistics } = this;
        statistics.points += stats.points;
        statistics.lines += stats.lines;
        statistics.triangles += stats.triangles;
        statistics.drawCalls += drawCalls;
    }

    /** @internal */
    addLoadStatistics(numPrimitives: number) {
        this.statistics.primitives += numPrimitives;
    }

    /** @internal */
    contextLost() {
        const { modules } = this;
        if (modules) {
            for (const module of modules) {
                module?.contextLost();
            }
        }
    }

    /** @internal */
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

    /** Poll the status of WebGL pick fences and timers and resolve associated promises when possible. */
    public poll() {
        this.buffers?.pollPickFence();
        this.viewClipMatrixLastPoll = mat4.clone(this.viewClipMatrix);
        this.viewWorldMatrixLastPoll = mat4.clone(this.viewWorldMatrix);
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

    /** Wait for the next frame to be ready for rendering.
     * @param context render context to wait for, if any.
     * @remarks Use this function instead of requestAnimationFrame()!
     */
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

    /**
     * Render a new frame using the specified render state.
     * @param state An object describing what the frame should look like.
     * @returns A promise to the performance related statistics involved in rendering this frame.
     */
    public async render(state: RenderState): Promise<RenderStatistics> {
        if (!this.modules) {
            throw new Error("Context has not been initialized!");
        }
        const beginTime = performance.now();
        const { gl, canvas, prevState } = this;
        this.changed = false;

        this.resetStatistics();

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
            const dir = vec3.sub(vec3.create(), state.camera.position, this.localSpaceTranslation).map(c => Math.abs(c));
            const dist = Math.max(dir[0], dir[2]) //Skip Y as we will not get an issue with large Y offset and we elevations internally in shader.
            // don't change localspace unless camera is far enough away. we want to avoid flipping back and forth across snap boundaries.
            if (dist >= snapDist) {
                function snap(v: number) {
                    return Math.round(v / snapDist) * snapDist;
                }
                this.localSpaceTranslation = vec3.fromValues(snap(state.camera.position[0]), 0, snap(state.camera.position[2]));
            }

            derivedState.localSpaceTranslation = this.localSpaceTranslation; // update the object reference to indicate that values have changed
            derivedState.matrices = matricesFromRenderState(state);
            derivedState.viewFrustum = createViewFrustum(state, derivedState.matrices);
        }
        this.currentState = derivedState;
        this.pickBuffersValid = false;
        const { buffers } = this;
        buffers.readBuffersNeedUpdate = true;

        this.updateCameraUniforms(derivedState);
        this.updateClippingUniforms(derivedState);

        // update internal state
        this.isOrtho = derivedState.camera.kind == "orthographic";
        mat4.copy(this.viewClipMatrix, derivedState.matrices.getMatrix(CoordSpace.View, CoordSpace.Clip));
        mat4.copy(this.viewWorldMatrix, derivedState.matrices.getMatrix(CoordSpace.View, CoordSpace.World));
        mat3.copy(this.viewWorldMatrixNormal, derivedState.matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World));

        // update modules from state
        if (!this.pause) {
            for (const module of this.modules) {
                module?.update(derivedState);
            }
        }

        // link any updates programs asynchronously here
        this.linkAsyncPrograms();

        // pick frame buffer and clear z-buffer
        const { width, height } = canvas;

        this.setPolygonFillMode("FILL");

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
                    this.resetGLState();
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
                this.resetGLState();
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
        } as const satisfies RenderStatistics;
    }

    //* @internal */
    clearPickBuffers() {
        glClear(this.gl, { kind: "COLOR", drawBuffer: 1, type: "Uint", color: [0xffffffff, 0x0000_0000, 0x0000_0000, 0x0000_0000] }); // 0xffff is bit-encoding for Float16.nan. (https://en.wikipedia.org/wiki/Half-precision_floating-point_format)
    }

    //* @internal */
    renderPickBuffers() {
        if (!this.pickBuffersValid) {
            if (!this.modules) {
                throw new Error("Context has not been initialized!");
            }
            const { gl, width, height, buffers, currentState } = this;
            if (!currentState) {
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
            this.clearPickBuffers();

            for (const module of this.modules) {
                if (module) {
                    glState(gl, stateParams);
                    module.pick?.(currentState);
                    this.resetGLState();
                }
            }

            if (currentState.tonemapping.mode != TonemappingMode.color) {
                // update debug display
                const tonemapModule = this.modules?.find(m => m.module.kind == "tonemap");
                glState(gl, { viewport: { width, height } });

                // glState(gl, {
                //     viewport: { width, height },
                //     frameBuffer: this.buffers.frameBuffers["color"],
                //     drawBuffers: this.drawBuffers(BufferFlags.color),
                // });

                tonemapModule?.render(currentState);
                this.resetGLState();
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

    /**
* scan the pick buffer for deviation values
* @returns Return pixel coordinates and deviation values for any deviation on screen 
*/
    async getDeviations(): Promise<DeviationSample[]> {
        this.renderPickBuffers();
        const pickBufferPromise = this.buffers.pickBuffers();
        this.currentPick = (await pickBufferPromise).pick;
        const { currentPick, width, height, canvas, wasm } = this;
        if (currentPick === undefined || width * height * 4 != currentPick.length) {
            return [];
        }

        const u16 = new Uint16Array(currentPick.buffer);
        const floats = new Float32Array(currentPick.buffer);
        const samples: DeviationSample[] = [];
        const { isOrtho, viewClipMatrixLastPoll, viewWorldMatrixLastPoll } = this;
        for (let iy = 0; iy < height; iy++) {
            for (let ix = 0; ix < width; ix++) {
                const buffOffs = ix + iy * width;
                const objectId = currentPick[buffOffs * 4];
                if (objectId != 0xffffffff) {
                    const deviation16 = u16[buffOffs * 8 + 5];
                    const dev32 = wasm.float32(deviation16);
                    const deviation = deviation16 !== 0 ? dev32 : undefined;

                    if (deviation) {
                        const depth = floats[buffOffs * 4 + 3];

                        const xCS = ((ix + 0.5) / width) * 2 - 1;
                        const yCS = ((iy + 0.5) / height) * 2 - 1;

                        // compute view space position and normal
                        const scale = isOrtho ? 1 : depth;
                        const posVS = vec3.fromValues((xCS / viewClipMatrixLastPoll[0]) * scale, (yCS / viewClipMatrixLastPoll[5]) * scale, -depth);
                        // convert into world space.
                        const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrixLastPoll);

                        samples.push({ x: ix, y: height - iy, deviation, position, depth });
                    }
                }
            }
        }
        return samples;
    }

    /**
* scan the pick buffer for pixels from clipping outline
* @returns Return pixel coordinates and world position for any clipping outline on screen 
*/
    async getOutlines(): Promise<OutlineSample[]> {
        this.renderPickBuffers();
        this.currentPick = (await this.buffers.pickBuffers()).pick;
        const { currentPick, width, height } = this;
        if (currentPick === undefined || width * height * 4 != currentPick.length) {
            return [];
        }

        const floats = new Float32Array(currentPick.buffer);
        const samples: OutlineSample[] = [];
        const { isOrtho, viewClipMatrixLastPoll, viewWorldMatrixLastPoll } = this;
        for (let iy = 0; iy < height; iy++) {
            for (let ix = 0; ix < width; ix++) {
                const buffOffs = ix + iy * width;
                const objectId = currentPick[buffOffs * 4];
                if (objectId < 0xf000_0000 && (objectId & (1 << 31)) != 0) {
                    const depth = floats[buffOffs * 4 + 3];

                    const xCS = ((ix + 0.5) / width) * 2 - 1;
                    const yCS = ((iy + 0.5) / height) * 2 - 1;

                    // compute view space position and normal
                    const scale = isOrtho ? 1 : depth;
                    const posVS = vec3.fromValues((xCS / viewClipMatrixLastPoll[0]) * scale, (yCS / viewClipMatrixLastPoll[5]) * scale, -depth);
                    // convert into world space.
                    const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrixLastPoll);

                    samples.push({ x: ix, y: height - iy, position, });
                }
            }
        }
        return samples;
    }

    private updateCameraUniforms(state: DerivedRenderState) {
        const { cameraUniformsData, localSpaceTranslation } = this;
        const { output, camera, matrices, background } = state;
        const { values } = cameraUniformsData;
        const r = -glMatrix.toRadian(background.rotation ?? 0);
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
        values.localBackgroundMatrixNormal = mat3.fromQuat(mat3.create(), quat.fromValues(0, Math.sin(r), 0, Math.cos(r)));
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

    /** @internal */
    updateOutlinesUniforms(state: RenderStateOutlines, plane: ReadonlyVec4, planeIndex?: number, color?: RGB) {
        const { outlineUniforms, outlinesUniformsData } = this;
        // transform outline plane into local space
        const [x, y, z, offset] = plane;
        const normal = vec3.fromValues(x, y, z);
        const distance = -offset - vec3.dot(this.localSpaceTranslation, normal);
        // const margin = 0.001; // add a tiny margin so that these lines aren't clipped by the clipping plane itself
        const planeLS = vec4.fromValues(normal[0], normal[1], normal[2], -distance);
        // compute plane projection matrices
        // const localPlaneMatrix = othoNormalBasisMatrixFromPlane(planeLS);
        // const planeLocalMatrix = mat4.invert(mat4.create(), localPlaneMatrix);
        const planeLocalMatrix = orthoNormalBasisMatrixFromPlane(planeLS);
        const localPlaneMatrix = mat4.invert(mat4.create(), planeLocalMatrix);
        // set uniform values
        const { values } = outlinesUniformsData;
        values.planeLocalMatrix = planeLocalMatrix;
        values.localPlaneMatrix = localPlaneMatrix;
        values.lineColor = color ?? state.lineColor;
        values.pointColor = state.vertexColor;
        values.planeIndex = planeIndex ?? -1;
        values.linearSize = state.linearThickness;
        values.minPixelSize = state.minPixelThickness;
        values.maxPixelSize = state.maxPixelThickness;
        values.pointScale = state.relativePointSize;
        values.pointObjectIdBase = state.vertexObjectIdBase;
        this.updateUniformBuffer(outlineUniforms, outlinesUniformsData);
    }



    /** @internal */
    screenSpaceLaser(laserPoint: ReadonlyVec2, xDir?: ReadonlyVec2, yDir?: ReadonlyVec2, zDir?: ReadonlyVec2) {
        const { currentPick, wasm, width, height, viewClipMatrixLastPoll, viewWorldMatrixLastPoll, isOrtho } = this;
        if (currentPick == undefined) {
            return undefined;
        }
        const makeSample = (x: number, y: number) => {
            const offset = x + (y * width);
            const objectId = currentPick[offset * 4];
            if (objectId != 0xffffffff) {
                const [depth] = new Float32Array(currentPick.buffer, offset * 16 + 12, 1);
                const [nx16, ny16, nz16] = new Uint16Array(currentPick.buffer, offset * 16 + 4, 4);
                const nx = wasm.float32(nx16);
                const ny = wasm.float32(ny16);
                const nz = wasm.float32(nz16);

                // compute normal
                // compute clip space x,y coords
                const xCS = ((x + 0.5) / width) * 2 - 1;
                const yCS = ((y + 0.5) / height) * 2 - 1;

                // compute view space position and normal
                const scale = isOrtho ? 1 : depth;
                const posVS = vec3.fromValues((xCS / viewClipMatrixLastPoll[0]) * scale, (yCS / viewClipMatrixLastPoll[5]) * scale, -depth);

                // convert into world space.
                const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrixLastPoll);
                const normal = vec3.fromValues(nx, ny, nz);
                vec3.normalize(normal, normal);
                return { objectId, normal, position, depth };
            }
            return { objectId };
        };

        const laserSample = makeSample(laserPoint[0], laserPoint[1]);
        if (laserSample.position == undefined) {
            return undefined;
        }

        const flipToCad = (v: ReadonlyVec3) => vec3.fromValues(v[0], -v[2], v[1]);

        const getLaserIntersection = (dir?: ReadonlyVec2, out?: boolean) => {
            if (dir == undefined) {
                return [];
            }
            const currentPos = vec2.clone(laserPoint);
            let prevDepth = laserSample.depth;
            const updateToNext = () => {
                const updatePos = vec2.add(vec2.create(), currentPos, dir);
                while (
                    Math.floor(updatePos[0]) == Math.floor(currentPos[0]) &&
                    Math.floor(updatePos[1]) == Math.floor(currentPos[1])) {
                    vec2.add(updatePos, updatePos, dir);
                }
                if (updatePos[0] >= width || updatePos[1] >= height ||
                    updatePos[0] < 0 || updatePos[1] < 0
                ) {
                    return false;
                }
                vec2.copy(currentPos, updatePos);
                return true;
            }

            let prevSample: { objectId: number, normal?: ReadonlyVec3, position?: ReadonlyVec3, depth?: number } = laserSample;
            while (updateToNext()) {
                const currentSample = makeSample(Math.floor(currentPos[0]), Math.floor(currentPos[1]));
                if (out) {
                    if (currentSample.position == undefined) {
                        return [];
                    }
                    if (areVectorsSameOrOppositeDirection(laserSample.normal, vec3.sub(vec3.create(), currentSample.position, laserSample.position))) {
                        return [flipToCad(currentSample.position)];
                    }
                } else {
                    if (currentSample.position == undefined) {
                        return prevSample.position;
                    }
                    if (currentSample.objectId != laserSample.objectId ||
                        Math.abs(vec3.dot(laserSample.normal, currentSample.normal)) < 0.9) {
                        return [flipToCad(prevSample.position!)];
                    }
                    prevSample = currentSample;
                    if (currentSample.depth) {
                        prevDepth = currentSample.depth;
                    }
                }
            }
            return [];
        };
        const inverse = (dir?: ReadonlyVec2) => {
            if (dir) {
                return vec2.fromValues(-dir[0], -dir[1]);
            }
            return dir;
        }

        return {
            right: getLaserIntersection(xDir) as ReadonlyVec3[],
            left: getLaserIntersection(inverse(xDir)) as ReadonlyVec3[],
            up: getLaserIntersection(yDir) as ReadonlyVec3[],
            down: getLaserIntersection(inverse(yDir)) as ReadonlyVec3[],
            zUp: getLaserIntersection(zDir, true) as ReadonlyVec3[]
        }
    }

    private extractPick(pickBuffer: Uint32Array, x: number, y: number, sampleDiscRadius: number, pickCameraPlane: boolean) {
        const { canvas, wasm, width, height } = this;
        const rect = canvas.getBoundingClientRect(); // dim in css pixels
        const cssWidth = rect.width;
        const cssHeight = rect.height;
        // convert to pixel coords
        const px = Math.min(Math.max(0, Math.round(x / cssWidth * width)), width);
        const py = Math.min(Math.max(0, Math.round((1 - (y + 0.5) / cssHeight) * height)), height);


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
        if (y1 > height) y1 = height;
        const samples: PickSample[] = [];
        const { isOrtho, viewClipMatrixLastPoll, viewWorldMatrixLastPoll } = this;
        const f16Max = 65504;

        for (let iy = y0; iy < y1; iy++) {
            const dy = iy - py;
            for (let ix = x0; ix < x1; ix++) {
                const dx = ix - px;
                if (dx * dx + dy * dy > r2)
                    continue; // filter out samples that lie outside sample disc radius
                const buffOffs = ix + iy * width;
                let objectId = pickBuffer[buffOffs * 4];
                if (objectId != 0xffffffff) {
                    const isReservedId = objectId >= 0xf000_0000
                    const depth = pickCameraPlane ? 0 : new Float32Array(pickBuffer.buffer, buffOffs * 16 + 12, 1)[0];
                    const [nx16, ny16, nz16, pointFactor16] = new Uint16Array(pickBuffer.buffer, buffOffs * 16 + 4, 4);
                    const nx = wasm.float32(nx16);
                    const ny = wasm.float32(ny16);
                    const nz = wasm.float32(nz16);
                    const pf32 = wasm.float32(pointFactor16);
                    const pointFactor = pointFactor16 !== 0 ? pf32 : undefined;

                    // compute normal
                    // compute clip space x,y coords
                    const xCS = ((ix + 0.5) / width) * 2 - 1;
                    const yCS = ((iy + 0.5) / height) * 2 - 1;

                    // compute view space position and normal
                    const scale = isOrtho ? 1 : depth;

                    const posVS = vec3.fromValues((xCS / viewClipMatrixLastPoll[0]) * scale, (yCS / viewClipMatrixLastPoll[5]) * scale, -depth);

                    // convert into world space.
                    const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrixLastPoll);
                    const normal = vec3.fromValues(nx, ny, nz);
                    vec3.normalize(normal, normal);
                    const clippingOutline = isReservedId ? false : (objectId & (1 << 31)) != 0;
                    objectId = isReservedId ? objectId : objectId & ~(1 << 31);

                    const sample = { x: ix - px, y: iy - py, position, normal, objectId, pointFactor, depth, clippingOutline } as const;
                    samples.push(sample);
                }
            }
        }
        return samples;
    }

    /**
     * Pick information about underlying object and geometry.
     * @param x Center x coordinate in CSS pixels.
     * @param y Center y coordinate in CSS pixels.
     * @param options More details of pick operation.
     * @returns A set of pick samples of the specified sample disc.
     */
    async pick(x: number, y: number, options?: PickOptions): Promise<PickSample[]> {
        const sampleDiscRadius = options?.sampleDiscRadius ?? 0;
        const callAsync = options?.async ?? true;
        const pickCameraPlane = options?.pickCameraPlane ?? false;
        if (sampleDiscRadius < 0)
            return [];
        this.renderPickBuffers();
        const pickBufferPromise = this.buffers.pickBuffers();
        let updateCurrentPickLater = false;
        if (callAsync) {
            try {
                this.currentPick = (await pickBufferPromise).pick;
            } catch (ex) {
                if (ex !== "disposed") {
                    console.warn("Error picking (async)", ex);
                }
                updateCurrentPickLater = true;
            }
        }

        if (!callAsync || updateCurrentPickLater) {
            pickBufferPromise
                .then(({ pick }) => { this.currentPick = pick })
                .catch(ex => {
                    if (ex !== "disposed") {
                        console.warn("Error picking (non async)", ex);
                    }
                });
        }
        const { currentPick, width, height } = this;
        if (currentPick === undefined || width * height * 4 != currentPick.length) {
            return [];
        }
        return this.extractPick(currentPick, x, y, sampleDiscRadius, pickCameraPlane);
    }

    setPolygonFillMode(mode: "FILL" | "LINE") {
        const { gl, polygonMode } = this;
        if (polygonMode) {
            const modeVal = polygonMode[`${mode}_WEBGL`];
            polygonMode.polygonModeWEBGL(gl.FRONT_AND_BACK, modeVal);
        }
    }

}

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
}

function areVectorsSameOrOppositeDirection(vec1: ReadonlyVec3, vec2: ReadonlyVec3) {
    // Check ratios of each component
    const ratioX = (vec1[0] !== 0) ? (vec2[0] / vec1[0]) : (vec2[0] === 0 ? 1 : null);
    const ratioY = (vec1[1] !== 0) ? (vec2[1] / vec1[1]) : (vec2[1] === 0 ? 1 : null);
    const ratioZ = (vec1[2] !== 0) ? (vec2[2] / vec1[2]) : (vec2[2] === 0 ? 1 : null);

    // Check if the ratios are consistent (equal or null), either all positive or all negative
    const allPositive = (ratioX === null || ratioX >= 0) &&
        (ratioY === null || ratioY >= 0) &&
        (ratioZ === null || ratioZ >= 0);

    const allNegative = (ratioX === null || ratioX <= 0) &&
        (ratioY === null || ratioY <= 0) &&
        (ratioZ === null || ratioZ <= 0);

    return allPositive || allNegative;
}


/**
 * Deviation sampled from screen
 */
export interface OutlineSample {
    /** x coordinate in pixel space */
    readonly x: number;
    /** y coordinate in pixel space */
    readonly y: number;
    /** World space position of underlying pixel. */
    readonly position: ReadonlyVec3;
}

/**
 * Deviation sampled from screen
 */
export interface DeviationSample {
    /** x coordinate in pixel space */
    readonly x: number;
    /** y coordinate in pixel space */
    readonly y: number;
    /** World space position of underlying pixel. */
    readonly position: ReadonlyVec3;
    /** The spatial deviation of underlying pixel.
     * @remarks This only applies to point clouds with precomputed deviation data.
     */
    readonly deviation: number;
    /** The depth/distance from the view plane. */
    readonly depth: number;
}

/**
 * Pick Sample information 
 */
export interface PickSample {
    /** relative x pixel offset (not css pixel) from pick center. */
    readonly x: number;
    /** relative y pixel offset (not css pixel) from pick center. */
    readonly y: number;
    /** World space position of underlying pixel. */
    readonly position: ReadonlyVec3;
    /** World space normal of underlying pixel. */
    readonly normal: ReadonlyVec3;
    /** The object id/index of underlying pixel. */
    readonly objectId: number;
    /**  The value of the currently selected point visualization of the underlying pixel, if any. */
    readonly pointFactor?: number;
    /** The depth/distance from the view plane. */
    readonly depth: number;
    /** The picked pixel is part of clipping outline */
    readonly clippingOutline: boolean;
};

/** Extra pick options. */
export interface PickOptions {
    /** The radius of the sample disc (0 yields a single pixel). */
    readonly sampleDiscRadius?: number,
    /** True to wait for the pick buffers to be available, false to return whatever is in the current pick buffer synchronously.
     * @remarks The latter option is more error prone, but useful for e.g. mouse hover operations.
     */
    readonly async?: boolean;
    /** Return pick without depth. */
    readonly pickCameraPlane?: boolean;
    /** Return only picked pixels with clipping outline. */
    readonly pickOutline?: boolean;
}

/** Parameters for asynchronous shader compilation and linking. */
export interface AsyncProgramParams {
    /** For debugging/diagnostics purposes. */
    readonly name?: string;
    /** Common GLSL header information to be inserted before the body code. */
    readonly header?: Partial<ShaderHeaderParams>;
    /** The vertex shader. */
    readonly vertexShader: string;
    /** The fragment shader (optional with transform feedback shaders). */
    readonly fragmentShader?: string;
    /** The names of the vertex attributes to be bound prior to linking using gl.bindAttribLocation(). */
    readonly attributes?: readonly string[]; // The names of the vertex attributes to be bound using gl.bindAttribLocation().
    /** The names of the shader uniform blocks to be bound prior to linking using gl.uniformBlockBinding(), in the order which they appear */
    readonly uniformBufferBlocks?: readonly string[];
    /** Texture uniforms to be bound post-linking. */
    readonly textureUniforms?: readonly string[]; // Texture uniforms will be bound to the index in which they appear in the name array.
    /** Transform feedback buffers to be bound post-linking. */
    readonly transformFeedback?: {
        /** Should output attributes be written into a single interleaved buffer or separate buffers? */
        readonly bufferMode: "INTERLEAVED_ATTRIBS" | "SEPARATE_ATTRIBS";
        /** Name of output attribute names (varyings). */
        readonly varyings: readonly string[];
    };
}

/** @internal */
interface AsyncProgramInfo {
    readonly name?: string; // for debugging purposes only.
    readonly program: WebGLProgram;
    readonly vertex: WebGLShader;
    readonly fragment: WebGLShader;
    readonly resolve: () => void;
    readonly reject: (reason: any) => void;
}

/** Render frame performance and resource usage statistics. */
export interface RenderStatistics {
    /** Estimated # bytes used by WebGL buffers for this frame. */
    readonly bufferBytes: number;
    /** Estimated # bytes uses by WebGL textures for this frame. */
    readonly textureBytes: number;
    /** # of points drawn in this frame. */
    readonly points: number;
    /** # of lines drawn in this frame. */
    readonly lines: number;
    /** # of triangles drawn in this frame. */
    readonly triangles: number;
    /** # of draw calls in this frame. */
    readonly drawCalls: number;
    /** # of primitives (points+lines+triangles) drawn by static geometry for this frame. */
    readonly primitives: number;
    /** Time spent in the main thread. */
    readonly cpuTime: {
        /** # CPU milliseconds spent rendering. */
        readonly draw: number;
    }
    /** Time spent in the GPU. */
    readonly gpuTime: {
        /** # GPU milliseconds spent rendering, if supported by driver. */
        readonly draw: number | undefined;
    }
    /** Effective interval in milliseconds since last frame was drawn. */
    readonly frameInterval: number;
};
