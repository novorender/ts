import { CoordSpace, TonemappingMode, type RGB, defaultRenderState } from "..";
import type { RenderModuleContext, RenderModule, DerivedRenderState, RenderState, Core3DImports } from "..";
import { matricesFromRenderState } from "../matrices";
import { createViewFrustum } from "../viewFrustum";
import { BufferFlags, RenderBuffers } from "./buffers";
import type { WasmInstance } from "../wasm";
import type { ReadonlyVec3, ReadonlyVec4 } from "gl-matrix";
import { mat3, mat4, vec3, vec4 } from "gl-matrix";
import { ResourceBin } from "./resource";
import type { DeviceProfile } from "../device";
import { orthoNormalBasisMatrixFromPlane } from "../util";
import { createDefaultModules } from "../modules/default";

// TODO: This is imported from webgl2 but it's totally independent, maybe move it to a common folder
import type { DrawStatistics } from "webgl2";
import shader from "core3d/modules/tonemap/shaders/shader.wgsl";

// the context is re-created from scratch if the underlying webgl2 context is lost

/** The view specific context for rendering and picking.
 * @remarks
 * A render context describes a view into which a {@link RenderState} can be rendered.
 * It is tightly bound to a HTML canvas and TODO XXX.
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
export class RenderContextWebGPU {
    /** WebGPU adapter associated with this object. */
    adapter: GPUAdapter | undefined;
    device: GPUDevice | undefined;
    context: GPUCanvasContext | undefined;
    /** WebGPU common WGSL code header used across shaders. */
    readonly commonChunk: string;
    /** WebGPU basic fallback IBL textures to use while loading proper IBL textures. */
    defaultIBLTextureParams: GPUTextureDescriptor | undefined;
    /** Web assembly instance. */
    readonly wasm: WasmInstance;

    private static defaultModules: readonly RenderModule[] | undefined;
    private modules: readonly RenderModuleContext[] | undefined;
    // TODO
    // private cameraUniformsData;
    // private clippingUniformsData;
    // private outlinesUniformsData;
    private localSpaceTranslation = vec3.create() as ReadonlyVec3;
    private readonly asyncPrograms: AsyncProgramInfo[] = [];
    private readonly resourceBins = new Set<ResourceBin>();
    private defaultResourceBin: ResourceBin | undefined;
    private iblResourceBin: ResourceBin | undefined;
    private pickBuffersValid = false;
    private currentPick: Uint32Array | undefined;
    // TODO
    // private activeTimers = new Set<Timer>();
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
    private lostJustHappened = true;
    private emulatingContextLoss = false;
    private toneMappingPipeline: GPURenderPipeline | undefined;
    private toneMappingBindGroup: GPUBindGroup | undefined;
    private toneMappingUniforms: GPUBuffer | undefined;
    private toneMappingUniformsStaging: GPUBuffer | undefined;

    // constant gl resources
    // TODO
    /** WebGL uniform buffer for camera related uniforms. */
    // readonly cameraUniforms: WebGLBuffer;
    // /** WebGL uniform buffer for clipping related uniforms. */
    // readonly clippingUniforms: WebGLBuffer;
    // /** WebGL uniform buffer for outline related uniforms. */
    // readonly outlineUniforms: WebGLBuffer;
    // /** WebGL GGX/PBR shading lookup table texture. */
    // readonly lut_ggx: WebGLTexture;
    // /** WebGL Sampler used to sample mipmapped diffuse IBL texture. */
    // readonly samplerMip: WebGLSampler; // use to read diffuse texture
    // /** WebGL Sampler used to sample other, non-mipmapped IBL textures. */
    // readonly samplerSingle: WebGLSampler; // use to read the other textures

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
    // TODO
    // iblTextures: { // these are changed by the background module, once download is complete
    //     /** WebGL cubemap texture containing the irradiance/diffuse values of current IBL environment. */
    //     readonly diffuse: GPUTexture;
    //     /** WebGL cubemap texture containing the radiance/specular values of current IBL environment. */
    //     readonly specular: GPUTexture;
    //     /** # mip maps in current specular texture. */
    //     readonly numMipMaps: number;
    //     /** # True if these are the default IBL textures. */
    //     readonly default: boolean;
    // };

    /** @internal */
    constructor(
        /** The device profile use for this context. */
        readonly deviceProfile: DeviceProfile,
        /** The HTML canvas used for this context. */
        readonly canvas: HTMLCanvasElement,
        /** Imported resources. */
        readonly imports: Core3DImports,
        // webGLOptions?: WebGLContextAttributes,
    ) {
        // TODO: Check equivalents to loseContext and provokingVertex in WebGPU the others
        // are supported by default
        // console.assert(extensions.loseContext != null, extensions.multiDraw != null, extensions.colorBufferFloat != null);
        // const { provokingVertex } = extensions;
        // if (provokingVertex) {
        //     provokingVertex.provokingVertexWEBGL(provokingVertex.FIRST_VERTEX_CONVENTION_WEBGL);
        // }
        this.commonChunk = imports.shaders.common;
        this.wasm = imports.wasmInstance;

        // ggx lookup texture and ibl samplers
        // TODO: create textures for ggx LUTs
        // gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        // const lutParams = { kind: "TEXTURE_2D", internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: imports.lutGGX } as const;
        // this.lut_ggx = defaultBin.createTexture(lutParams);
        // this.samplerSingle = defaultBin.createSampler({ minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        // this.samplerMip = defaultBin.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });


        // camera uniforms
        // TODO
        // this.cameraUniformsData = glUBOProxy({
        //     clipViewMatrix: "mat4",
        //     viewClipMatrix: "mat4",
        //     localViewMatrix: "mat4",
        //     viewLocalMatrix: "mat4",
        //     localViewMatrixNormal: "mat3",
        //     viewLocalMatrixNormal: "mat3",
        //     windowSize: "vec2",
        //     near: "float",
        // });
        // this.cameraUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.cameraUniformsData.buffer.byteLength });

        // clipping uniforms
        // TODO
        // this.clippingUniformsData = glUBOProxy({
        //     "planes.0": "vec4",
        //     "planes.1": "vec4",
        //     "planes.2": "vec4",
        //     "planes.3": "vec4",
        //     "planes.4": "vec4",
        //     "planes.5": "vec4",
        //     numPlanes: "uint",
        //     mode: "uint",
        // });
        // this.clippingUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.clippingUniformsData.buffer.byteLength });

        // outlines uniforms
        // TODO
        // this.outlinesUniformsData = glUBOProxy({
        //     localPlaneMatrix: "mat4",
        //     planeLocalMatrix: "mat4",
        //     color: "vec3",
        //     planeIndex: "int",
        // });
        // this.outlineUniforms = glCreateBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.outlinesUniformsData.buffer.byteLength });
    }

    /** Initialize render context with specified render modules.
     * @remarks
     * The default/built-in render modules can be retrieved using {@link createDefaultModules}.
     * These will be used if no modules are specified.
     * Developers may introduce their own render modules here.
     * Note that the order of the modules matters, as this is the order by which they will be rendered.
     */
    async init(modules?: readonly RenderModule[]) {
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported on this browser.");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }
        this.adapter = adapter;

        const context = this.canvas.getContext("webgpu");
        if (!context) {
            throw new Error("Couldn't get webgpu context from canvas");
        }
        this.context = context;

        this.device = await adapter.requestDevice();
        this.device.lost.then(async value => {
            // After device lost, re-initialize for new adapter and device.
            // We choose a different texture color from when we first
            // init to be sure that the texture is coming from here
            this.device = undefined;
            this.adapter = undefined;
            this.context = undefined;
            this.modules = undefined;
            this.lostJustHappened = true;

            console.log(`Context lost just reinitializing by now, reason: ${value.reason}, message: ${value.message}`);

            if(value.reason != "destroyed" || this.emulatingContextLoss) {
                this.init();
            }
        });

        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: canvasFormat,
        });

        this.lostJustHappened = false;
        this.emulatingContextLoss = false;

        const effectiveSamplesMSAA = this.effectiveSamplesMSAA(defaultRenderState());

        this.buffers = new RenderBuffers(
            this.device,
            this.context.getCurrentTexture().width,
            this.context.getCurrentTexture().height,
            effectiveSamplesMSAA,
            this.resourceBin("FrameBuffers")
        );

        console.log("WebGPU initialized");

        // initialize modules
        if (!modules) {
            RenderContextWebGPU.defaultModules ??= createDefaultModules();
            modules = RenderContextWebGPU.defaultModules;
        }


        const defaultBin = this.defaultResourceBin = this.resourceBin("context");
        const iblBin = this.iblResourceBin = this.resourceBin("ibl");

        // create default ibl textures
        const top = new Uint8Array([192, 192, 192, 255]);
        const side = new Uint8Array([128, 128, 128, 255]);
        const bottom = new Uint8Array([64, 64, 64, 255]);
        const image = [side, side, top, bottom, side, side] as const;
        const textureParams = this.defaultIBLTextureParams = {
            label: "Default IBL texture",
            size: { width: 1, height: 1 },
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING
        } as const;
        // this.iblTextures = {
        //     diffuse: iblBin.createTexture(textureParams),
        //     specular: iblBin.createTexture(textureParams),
        //     numMipMaps: 1,
        //     default: true,
        // };

        // TODO
        // const modulePromises = modules.map((m, i) => {
        //     const ret = m.withContext(this);
        //     return isPromise(ret) ? ret : Promise.resolve(ret);
        // });
        // this.linkAsyncPrograms();
        // this.modules = await Promise.all(modulePromises);

        // Create tonemapping render pipeline
        const toneMappingSM = defaultBin.createShaderModule({
            label: "Tonemapping shader module",
            code: shader,
        });
        this.toneMappingPipeline = defaultBin.createRenderPipeline({
            label: "Tonemapping pipeline",
            layout: "auto",
            vertex: {
                module: toneMappingSM,
                entryPoint: "vertexMain",
            },
            fragment: {
                module: toneMappingSM,
                entryPoint: "fragmentMain",
                targets: [{
                    format: canvasFormat
                }]
            },
            // We are drawing full screen with a cw triangle but not really using culling
            // primitive: {
            //     cullMode: "front",
            //     frontFace: "cw"
            // }
        });

        this.toneMappingUniformsStaging = defaultBin.createBuffer({
            size: 12,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
            mappedAtCreation: true,
        });
        this.toneMappingUniforms = defaultBin.createBuffer({
            size: 12,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const toneMappingUniformsData = new Float32Array(3);
        const toneMappingUniformsDataU32 = new Uint32Array(toneMappingUniformsData.buffer);
        // exposure
        toneMappingUniformsData[0] = 1.
        // mode
        toneMappingUniformsDataU32[1] = 0; // tonemapModeColor
        // maxLinearDepth
        toneMappingUniformsData[2] = 1.
        const gpuBuffer = new Float32Array(this.toneMappingUniformsStaging.getMappedRange());
        gpuBuffer.set(toneMappingUniformsData);
        this.toneMappingUniformsStaging.unmap();
        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(this.toneMappingUniformsStaging, 0, this.toneMappingUniforms, 0, 12);
        this.device.queue.submit([encoder.finish()]);



        this.toneMappingBindGroup = this.device.createBindGroup({
            label: "Tone mapping bind group",
            layout: this.toneMappingPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: this.buffers.textureViews.color
                },
                {
                    binding: 1,
                    resource: this.defaultResourceBin.createSampler({
                        label: "Tone mapping color texture sampler",
                    })
                },
                {
                    binding: 2,
                    resource: { buffer: this.toneMappingUniforms }
                }
            ]
        })
    }

    private linkAsyncPrograms() {
        // link all programs here (this is supposedly faster than interleaving compiles and links)
        // TODO
        // const { gl, asyncPrograms } = this;
        // for (const { program } of this.asyncPrograms) {
        //     gl.linkProgram(program);
        // }
        // gl.useProgram(null);

        // // wait for completion
        // const ext = glExtensions(gl).parallelShaderCompile;
        // function pollAsyncPrograms() {
        //     for (let i = 0; i < asyncPrograms.length; i++) {
        //         const { program, resolve, reject } = asyncPrograms[i];
        //         if (ext) {
        //             if (!gl.getProgramParameter(program, ext.COMPLETION_STATUS_KHR))
        //                 continue;
        //         }
        //         const [info] = asyncPrograms.splice(i--, 1);
        //         const error = glCheckProgram(gl, info);
        //         if (error) {
        //             reject(error);
        //         } else {
        //             resolve();
        //         }
        //     }
        //     if (asyncPrograms.length > 0) {
        //         setTimeout(pollAsyncPrograms);
        //     }
        // }
        // pollAsyncPrograms();
    }

    /**
     * Dispose of the GPU resources used by this context, effectively destroying it and freeing up memory.
     * @remarks
     * Calling this method is optional as the garbage collection of the underlying WebGL render context will do the same thing.
     * This may take some time, however, so calling this function is recommended if you plan to create a new context shortly thereafter.
     */
    dispose() {
        const { buffers, modules, /*activeTimers,*/ defaultResourceBin, iblResourceBin } = this;
        // TODO: This is surely not needed in webgpu
        // this.poll(); // finish async stuff

        // TODO
        // for (const timer of activeTimers) {
        //     timer.dispose();
        // }
        // activeTimers.clear();

        if (modules) {
            for (const module of modules) {
                module?.dispose();
            }
            this.modules = undefined;
        }
        buffers?.dispose();
        if(iblResourceBin) {
            iblResourceBin.dispose();
        }
        if(defaultResourceBin) {
            defaultResourceBin.dispose();
        }
        console.assert(this.resourceBins.size == 0);
    }

    /** Return the current pixel width of the drawing buffer. */
    get width() {
        return this.context?.getCurrentTexture().width;
    }

    /** Return the current pixel height of the drawing buffer. */
    get height() {
        return this.context?.getCurrentTexture().height;
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
        return this.lostJustHappened;
    }

    /** @internal */
    // TODO
    // drawBuffers(buffers: BufferFlags = (BufferFlags.all)): readonly (ColorAttachment | "NONE")[] {
    //     const activeBuffers = buffers; // & this.drawBuffersMask;
    //     return [
    //         activeBuffers & BufferFlags.color ? "COLOR_ATTACHMENT0" : "NONE",
    //         activeBuffers & BufferFlags.pick ? "COLOR_ATTACHMENT1" : "NONE",
    //     ] as const;
    // }

    /** Helper function to update WebGL uniform buffer from proxies. */
    // TODO
    // updateUniformBuffer(uniformBuffer: WebGLBuffer, proxy: UniformsProxy) {
    //     if (!proxy.dirtyRange.isEmpty) {
    //         const { begin, end } = proxy.dirtyRange;
    //         glUpdateBuffer(this.gl, { kind: "UNIFORM_BUFFER", srcData: proxy.buffer, targetBuffer: uniformBuffer, srcElementOffset: begin, dstByteOffset: begin, byteSize: end - begin });
    //         proxy.dirtyRange.clear();
    //     }
    // }

    /** Explicitly update WebGL IBL textures from specified parameters. */
    // TODO
    // updateIBLTextures(params: { readonly diffuse: GPUTextureDescriptor, readonly specular: GPUTextureDescriptor } | null) {
    //     // TODO
    //     const { iblResourceBin } = this;
    //     if(!iblResourceBin) {
    //         throw "Not initialized yet"
    //     }
    //     iblResourceBin.deleteAll();
    //     if (params) {
    //         const { diffuse, specular } = params;
    //         this.iblTextures = {
    //             diffuse: iblResourceBin.createTexture(diffuse),
    //             specular: iblResourceBin.createTexture(specular),
    //             numMipMaps: specular.mipLevelCount ?? 1,
    //             default: false,
    //         };
    //     } else {
    //         this.iblTextures = {
    //             diffuse: iblResourceBin.createTexture(this.defaultIBLTextureParams),
    //             specular: iblResourceBin.createTexture(this.defaultIBLTextureParams),
    //             numMipMaps: 1,
    //             default: true,
    //         };
    //     }
    // }

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
        if (!this.device) {
            throw "Device not initialized yet, probably init hasn't been called or awaited"
        }
        return new ResourceBin(this.device, name, this.resourceBins);
    }

    /** Compile WebGL/GLSL shader program asynchronously. */
    // TODO
    // makeProgramAsync(resourceBin: ResourceBin, params: AsyncProgramParams) {
    //     const { gl, commonChunk } = this;
    //     const { vertexShader, fragmentShader } = params;
    //     const header = { commonChunk, ...params.header } as const; // inject common shader code here, if not defined in params.
    //     const programAsync = resourceBin.createProgramAsync({ header, vertexShader, fragmentShader });
    //     const { program } = programAsync;

    //     // do pre-link bindings here
    //     const { attributes, transformFeedback, uniformBufferBlocks, textureUniforms } = params;
    //     if (attributes) {
    //         let i = 0;
    //         for (const name of attributes) {
    //             gl.bindAttribLocation(program, i++, name);
    //         }
    //     }
    //     if (transformFeedback) {
    //         const { varyings, bufferMode } = transformFeedback;
    //         gl.transformFeedbackVaryings(program, varyings, gl[bufferMode]);
    //     }

    //     return new Promise<WebGLProgram>((resolve, reject) => {
    //         // do post-link bindings here
    //         function postLink() {
    //             gl.useProgram(program);

    //             if (uniformBufferBlocks) {
    //                 let idx = 0;
    //                 for (const name of uniformBufferBlocks) {
    //                     if (name) {
    //                         const blockIndex = gl.getUniformBlockIndex(program, name);
    //                         if (blockIndex != gl.INVALID_INDEX) {
    //                             gl.uniformBlockBinding(program, blockIndex, idx);
    //                         } else {
    //                             console.warn(`Shader has no uniform block named: ${name}!`);
    //                         }
    //                     }
    //                     idx++;
    //                 }
    //             }

    //             if (textureUniforms) {
    //                 let i = 0;
    //                 for (const name of textureUniforms) {
    //                     const location = gl.getUniformLocation(program, name);
    //                     gl.uniform1i(location, i++);
    //                 }
    //             }

    //             gl.useProgram(null);
    //             resolve(program);
    //         }
    //         this.asyncPrograms.push({ ...programAsync, resolve: postLink, reject });
    //     });
    // }

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
        // TODO: Is this correct? loseContext is just destroy but restoreContext?
        if (value == "lose") {
            this.emulatingContextLoss = true;
            this.device?.destroy();
        }else{
            this.init();
        }
    }

    /** Poll the status of WebGL pick fences and timers and resolve associated promises when possible. */
    public poll() {
        // TODO
        // this.buffers?.pollPickFence();
        this.viewClipMatrixLastPoll = mat4.clone(this.viewClipMatrix);
        this.viewWorldMatrixLastPoll = mat4.clone(this.viewWorldMatrix);
        this.pollTimers();
    }

    // TODO
    // private beginTimer(): Timer {
    //     const timer = glCreateTimer(this.gl, false);
    //     this.activeTimers.add(timer);
    //     timer.begin();
    //     return timer;
    // }

    private pollTimers() {
        // TODO: surely not needed as eveything is now async
        // const { activeTimers } = this;
        // for (const timer of [...activeTimers]) {
        //     if (timer.poll()) {
        //         activeTimers.delete(timer);
        //         timer.dispose();
        //     }
        // }
    }

    /** Wait for the next frame to be ready for rendering.
     * @param context render context to wait for, if any.
     * @remarks Use this function instead of requestAnimationFrame()!
     */
    public static nextFrame(context: RenderContextWebGPU | undefined): Promise<number> {
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

    effectiveSamplesMSAA(state: RenderState) {
        // Apparently querying MSAA max samples is not supported yet:
        // https://github.com/gpuweb/gpuweb/pull/932
        const { MAX_SAMPLES } = { MAX_SAMPLES: 4 };
        return Math.max(1, Math.min(MAX_SAMPLES, Math.min(this.deviceProfile.limits.maxSamples, state.output.samplesMSAA)));
    }

    /**
     * Render a new frame using the specified render state.
     * @param state An object describing what the frame should look like.
     * @returns A promise to the performance related statistics involved in rendering this frame.
     */
    public async render(state: RenderState): Promise<RenderStatistics> {
        if (!this.adapter || !this.device || !this.context || !this.toneMappingPipeline || !this.toneMappingBindGroup) {
            throw new Error("Context has not been initialized!");
        }
        const beginTime = performance.now();
        const { context, device, adapter, canvas, prevState } = this;
        this.changed = false;

        this.resetStatistics();

        const effectiveSamplesMSAA = this.effectiveSamplesMSAA(state);

        // handle resizes
        let resized = false;
        const { output } = state;
        // TODO
        // if (this.hasStateChanged({ output })) {
        //     const { width, height } = output;
        //     console.assert(Number.isInteger(width) && Number.isInteger(height));
        //     canvas.width = width;
        //     canvas.height = height;
        //     resized = true;
        //     this.changed = true;
        //     this.buffers?.dispose();
        //     this.buffers = new RenderBuffers(this.device, width, height, effectiveSamplesMSAA, this.resourceBin("FrameBuffers"));
        // }

        const encoder = this.device.createCommandEncoder();
        if (!encoder){
            throw "Couldn't create a command encoder"
        }

        // Main render pass
        const mainPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.buffers.colorRenderAttachment(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 1.0, g: 0, b: 0.4, a: 1 },
                    resolveTarget: this.buffers.colorResolveAttachment()
                },
            ],
            depthStencilAttachment: {
                view: this.buffers.depthRenderAttachment(),
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthClearValue: 1.,
            }
        });

        mainPass.end();

        // Tone mapping render pass
        const toneMappingPass = encoder.beginRenderPass({
            colorAttachments: [{
                // TODO: Is this a performance problem? Cache the view?
                view: this.context.getCurrentTexture().createView(),
                loadOp: "load",
                storeOp: "store",
            }],
        })

        toneMappingPass.setPipeline(this.toneMappingPipeline);
        toneMappingPass.setBindGroup(0, this.toneMappingBindGroup);
        toneMappingPass.draw(3);
        toneMappingPass.end();

        // const commandBuffer = encoder.finish();

        this.device.queue.submit([encoder.finish()]);

        const endTime = performance.now();

        const intervalPromise = new Promise<number>((resolve) => {
            this.prevFrame = { time: this.currentFrameTime, resolve };
        });

        const stats = { ...this.statistics, bufferBytes: 0, textureBytes: 0 };
        const [gpuDrawTime, frameInterval] = await Promise.all([0, intervalPromise]);

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
        // TODO
        // glClear(this.gl, { kind: "COLOR", drawBuffer: 1, type: "Uint", color: [0xffffffff, 0x0000_0000, 0x0000_0000, 0x0000_0000] }); // 0xffff is bit-encoding for Float16.nan. (https://en.wikipedia.org/wiki/Half-precision_floating-point_format)
    }

    //* @internal */
    renderPickBuffers() {
        // TODO
        // if (!this.pickBuffersValid) {
        //     if (!this.modules) {
        //         throw new Error("Context has not been initialized!");
        //     }
        //     const { gl, width, height, buffers, currentState } = this;
        //     if (!currentState) {
        //         throw new Error("render() was not called!"); // we assume render() has been called first
        //     }

        //     const stateParams: StateParams = {
        //         viewport: { width, height },
        //         frameBuffer: buffers.frameBuffers.pick,
        //         drawBuffers: this.drawBuffers(BufferFlags.pick),
        //         depth: { test: true, writeMask: true },
        //     };
        //     glState(gl, stateParams);
        //     glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 }); // we need to clear (again) since depth might be different for pick and color renders and we're also not using MSAA depth buffer.
        //     // glClear(gl, { kind: "COLOR", drawBuffer: 1, type: "Float", color: [Number.POSITIVE_INFINITY, 0, 0, 0] });
        //     this.clearPickBuffers();

        //     for (const module of this.modules) {
        //         if (module) {
        //             glState(gl, stateParams);
        //             module.pick?.(currentState);
        //             // reset gl state
        //             glState(gl, null);
        //         }
        //     }

        //     if (currentState.tonemapping.mode != TonemappingMode.color) {
        //         // update debug display
        //         const tonemapModule = this.modules?.find(m => m.module.kind == "tonemap");
        //         glState(gl, { viewport: { width, height } });

        //         // glState(gl, {
        //         //     viewport: { width, height },
        //         //     frameBuffer: this.buffers.frameBuffers["color"],
        //         //     drawBuffers: this.drawBuffers(BufferFlags.color),
        //         // });

        //         tonemapModule?.render(currentState);
        //         // reset gl state
        //         glState(gl, null);
        //     }
        //     this.pickBuffersValid = true;
        // }
    }

    //* @internal */
    *getLinearDepths(pick: Uint32Array): IterableIterator<number> {
        const floats = new Float32Array(pick.buffer);
        for (let i = 3; i < pick.length; i += 4) {
            yield floats[i];
        }
    }

    //* @internal */
    getOutlineObjects(pick: Uint32Array) {
        const objs = new Set<number>();
        for (let i = 0; i < pick.length; i += 4) {
            const objectId = pick[i];
            if (objectId < 0xf000_0000 && (objectId & (1 << 31)) != 0) {
                objs.add(objectId & ~(1 << 31));
            }
        }
        return objs;
    }

    /**
* scan the pick buffer for deviation values
* @returns Return pixel coordinates and deviation values for any deviation on screen
*/
    async getDeviations(): Promise<DeviationSample[]> {
        // this.renderPickBuffers();
        // const pickBufferPromise = this.buffers.pickBuffers();
        // this.currentPick = (await pickBufferPromise).pick;
        // const { currentPick, width, height, canvas, wasm } = this;
        // if (currentPick === undefined || width * height * 4 != currentPick.length) {
        //     return [];
        // }

        // const u16 = new Uint16Array(currentPick.buffer);
        // const floats = new Float32Array(currentPick.buffer);
        // const samples: DeviationSample[] = [];
        // const { isOrtho, viewClipMatrixLastPoll, viewWorldMatrixLastPoll } = this;
        // for (let iy = 0; iy < height; iy++) {
        //     for (let ix = 0; ix < width; ix++) {
        //         const buffOffs = ix + iy * width;
        //         const objectId = currentPick[buffOffs * 4];
        //         if (objectId != 0xffffffff) {
        //             const deviation16 = u16[buffOffs * 8 + 5];
        //             const dev32 = wasm.float32(deviation16);
        //             const deviation = deviation16 !== 0 ? dev32 : undefined;

        //             if (deviation) {
        //                 const depth = floats[buffOffs * 4 + 3];

        //                 const xCS = ((ix + 0.5) / width) * 2 - 1;
        //                 const yCS = ((iy + 0.5) / height) * 2 - 1;

        //                 // compute view space position and normal
        //                 const scale = isOrtho ? 1 : depth;
        //                 const posVS = vec3.fromValues((xCS / viewClipMatrixLastPoll[0]) * scale, (yCS / viewClipMatrixLastPoll[5]) * scale, -depth);
        //                 // convert into world space.
        //                 const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrixLastPoll);

        //                 samples.push({ x: ix, y: height - iy, deviation, position, depth });
        //             }
        //         }
        //     }
        // }
        // return samples;

        throw "TODO";
    }

    /**
* scan the pick buffer for pixels from clipping outline
* @returns Return pixel coordinates and world position for any clipping outline on screen
*/
    async getOutlines(): Promise<OutlineSample[]> {
        // TODO
        // this.renderPickBuffers();
        // this.currentPick = (await this.buffers.pickBuffers()).pick;
        // const { currentPick, width, height } = this;
        // if (currentPick === undefined || width * height * 4 != currentPick.length) {
        //     return [];
        // }

        // const floats = new Float32Array(currentPick.buffer);
        // const samples: OutlineSample[] = [];
        // const { isOrtho, viewClipMatrixLastPoll, viewWorldMatrixLastPoll } = this;
        // for (let iy = 0; iy < height; iy++) {
        //     for (let ix = 0; ix < width; ix++) {
        //         const buffOffs = ix + iy * width;
        //         const objectId = currentPick[buffOffs * 4];
        //         if (objectId < 0xf000_0000 && (objectId & (1 << 31)) != 0) {
        //             const depth = floats[buffOffs * 4 + 3];

        //             const xCS = ((ix + 0.5) / width) * 2 - 1;
        //             const yCS = ((iy + 0.5) / height) * 2 - 1;

        //             // compute view space position and normal
        //             const scale = isOrtho ? 1 : depth;
        //             const posVS = vec3.fromValues((xCS / viewClipMatrixLastPoll[0]) * scale, (yCS / viewClipMatrixLastPoll[5]) * scale, -depth);
        //             // convert into world space.
        //             const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrixLastPoll);

        //             samples.push({ x: ix, y: height - iy, position, });
        //         }
        //     }
        // }
        // return samples;

        throw "TODO";
    }

    private updateCameraUniforms(state: DerivedRenderState) {
        // TODO
        // const { cameraUniformsData, localSpaceTranslation } = this;
        // const { output, camera, matrices } = state;
        // const { values } = cameraUniformsData;
        // const worldViewMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.View);
        // const viewWorldMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.World);
        // const worldLocalMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), localSpaceTranslation));
        // const localWorldMatrix = mat4.fromTranslation(mat4.create(), localSpaceTranslation);
        // values.clipViewMatrix = matrices.getMatrix(CoordSpace.Clip, CoordSpace.View);
        // values.viewClipMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        // values.viewClipMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        // values.localViewMatrix = mat4.multiply(mat4.create(), worldViewMatrix, localWorldMatrix);
        // values.viewLocalMatrix = mat4.multiply(mat4.create(), worldLocalMatrix, viewWorldMatrix,);
        // values.localViewMatrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
        // values.viewLocalMatrixNormal = matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World);
        // values.windowSize = [output.width, output.height];
        // values.near = camera.near;
        // this.updateUniformBuffer(this.cameraUniforms, this.cameraUniformsData);
    }

    private updateClippingUniforms(state: DerivedRenderState) {
        // TODO
        // const { clipping, matrices } = state;
        // if (this.hasStateChanged({ clipping, matrices })) {
        //     const { clippingUniforms, clippingUniformsData } = this;
        //     const { values } = clippingUniformsData;
        //     const { enabled, mode, planes } = clipping;
        //     // transform clipping planes into view space
        //     const normal = vec3.create();
        //     const position = vec3.create();
        //     const matrix = matrices.getMatrix(CoordSpace.World, CoordSpace.View);
        //     const matrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
        //     mat4.getTranslation(position, matrix);
        //     for (let i = 0; i < planes.length; i++) {
        //         const { normalOffset } = planes[i];
        //         const [x, y, z, offset] = normalOffset;
        //         vec3.set(normal, x, y, z);
        //         vec3.transformMat3(normal, normal, matrixNormal);
        //         const distance = offset + vec3.dot(position, normal);
        //         const plane = vec4.fromValues(normal[0], normal[1], normal[2], -distance);
        //         const idx = i as 0 | 1 | 2 | 3 | 4 | 5;
        //         values[`planes.${idx}` as const] = plane;
        //     }
        //     values["numPlanes"] = enabled ? planes.length : 0;
        //     values["mode"] = mode;
        //     this.updateUniformBuffer(clippingUniforms, clippingUniformsData);
        // }
    }

    /** @internal */
    updateOutlinesUniforms(plane: ReadonlyVec4, color: RGB, planeIndex: number) {
        // TODO
        // const { outlineUniforms, outlinesUniformsData } = this;
        // // transform outline plane into local space
        // const [x, y, z, offset] = plane;
        // const normal = vec3.fromValues(x, y, z);
        // const distance = -offset - vec3.dot(this.localSpaceTranslation, normal);
        // // const margin = 0.001; // add a tiny margin so that these lines aren't clipped by the clipping plane itself
        // const planeLS = vec4.fromValues(normal[0], normal[1], normal[2], -distance);
        // // compute plane projection matrices
        // // const localPlaneMatrix = othoNormalBasisMatrixFromPlane(planeLS);
        // // const planeLocalMatrix = mat4.invert(mat4.create(), localPlaneMatrix);
        // const planeLocalMatrix = orthoNormalBasisMatrixFromPlane(planeLS);
        // const localPlaneMatrix = mat4.invert(mat4.create(), planeLocalMatrix);
        // // set uniform values
        // const { values } = outlinesUniformsData;
        // values.planeLocalMatrix = planeLocalMatrix;
        // values.localPlaneMatrix = localPlaneMatrix;
        // values.color = color;
        // values.planeIndex = planeIndex;
        // this.updateUniformBuffer(outlineUniforms, outlinesUniformsData);
    }

    private extractPick(pickBuffer: Uint32Array, x: number, y: number, sampleDiscRadius: number, pickCameraPlane: boolean) {
        // TODO
        // const { canvas, wasm, width, height } = this;
        // const rect = canvas.getBoundingClientRect(); // dim in css pixels
        // const cssWidth = rect.width;
        // const cssHeight = rect.height;
        // // convert to pixel coords
        // const px = Math.min(Math.max(0, Math.round(x / cssWidth * width)), width);
        // const py = Math.min(Math.max(0, Math.round((1 - (y + 0.5) / cssHeight) * height)), height);

        // const floats = new Float32Array(pickBuffer.buffer);

        // // fetch sample rectangle from read buffers
        // const r = Math.ceil(sampleDiscRadius);
        // const r2 = sampleDiscRadius * sampleDiscRadius;
        // let x0 = px - r;
        // let x1 = px + r + 1;
        // let y0 = py - r;
        // let y1 = py + r + 1;
        // if (x0 < 0) x0 = 0;
        // if (x1 > width) x1 = width;
        // if (y0 < 0) y0 = 0;
        // if (y1 > height) y1 = height;
        // const samples: PickSample[] = [];
        // const { isOrtho, viewClipMatrixLastPoll, viewWorldMatrixLastPoll } = this;
        // const f16Max = 65504;

        // for (let iy = y0; iy < y1; iy++) {
        //     const dy = iy - py;
        //     for (let ix = x0; ix < x1; ix++) {
        //         const dx = ix - px;
        //         if (dx * dx + dy * dy > r2)
        //             continue; // filter out samples that lie outside sample disc radius
        //         const buffOffs = ix + iy * width;
        //         let objectId = pickBuffer[buffOffs * 4];
        //         if (objectId != 0xffffffff) {
        //             const isReservedId = objectId >= 0xf000_0000
        //             const depth = pickCameraPlane ? 0 : floats[buffOffs * 4 + 3];
        //             const [nx16, ny16, nz16, deviation16] = new Uint16Array(pickBuffer.buffer, buffOffs * 16 + 4, 4);
        //             const nx = wasm.float32(nx16);
        //             const ny = wasm.float32(ny16);
        //             const nz = wasm.float32(nz16);
        //             const dev32 = wasm.float32(deviation16);
        //             const deviation = deviation16 !== 0 ? dev32 : undefined;

        //             // compute normal
        //             // compute clip space x,y coords
        //             const xCS = ((ix + 0.5) / width) * 2 - 1;
        //             const yCS = ((iy + 0.5) / height) * 2 - 1;

        //             // compute view space position and normal
        //             const scale = isOrtho ? 1 : depth;

        //             const posVS = vec3.fromValues((xCS / viewClipMatrixLastPoll[0]) * scale, (yCS / viewClipMatrixLastPoll[5]) * scale, -depth);

        //             // convert into world space.
        //             const position = vec3.transformMat4(vec3.create(), posVS, viewWorldMatrixLastPoll);
        //             const normal = vec3.fromValues(nx, ny, nz);
        //             vec3.normalize(normal, normal);
        //             const clippingOutline = isReservedId ? false : (objectId & (1 << 31)) != 0;
        //             objectId = isReservedId ? objectId : objectId & ~(1 << 31);

        //             const sample = { x: ix - px, y: iy - py, position, normal, objectId, deviation, depth, clippingOutline } as const;
        //             samples.push(sample);
        //         }
        //     }
        // }
        // return samples;
    }

    /**
     * Pick information about underlying object and geometry.
     * @param x Center x coordinate in CSS pixels.
     * @param y Center y coordinate in CSS pixels.
     * @param options More details of pick operation.
     * @returns A set of pick samples of the specified sample disc.
     */
    async pick(x: number, y: number, options?: PickOptions): Promise<PickSample[]> {
        // TODO
        // const sampleDiscRadius = options?.sampleDiscRadius ?? 0;
        // const callAsync = options?.async ?? true;
        // const pickCameraPlane = options?.pickCameraPlane ?? false;
        // if (sampleDiscRadius < 0)
        //     return [];
        // this.renderPickBuffers();
        // const pickBufferPromise = this.buffers.pickBuffers();
        // if (callAsync) {
        //     this.currentPick = (await pickBufferPromise).pick;
        // } else {
        //     pickBufferPromise.then(({ pick }) => { this.currentPick = pick });
        // }
        // const { currentPick, width, height } = this;
        // if (currentPick === undefined || width * height * 4 != currentPick.length) {
        //     return [];
        // }
        // return this.extractPick(currentPick, x, y, sampleDiscRadius, pickCameraPlane);

        throw "TODO"
    }

}

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
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
    /** The spatial deviation of underlying pixel, if any.
     * @remarks This only applies to point clouds with precomputed deviation data.
     */
    readonly deviation?: number;
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

// TODO: probably not needed
/** Parameters for asynchronous shader compilation and linking. */
// export interface AsyncProgramParams {
//     /** Common GLSL header information to be inserted before the body code. */
//     readonly header?: Partial<ShaderHeaderParams>;
//     /** The vertex shader. */
//     readonly vertexShader: string;
//     /** The fragment shader (optional with transform feedback shaders). */
//     readonly fragmentShader?: string;
//     /** The names of the vertex attributes to be bound prior to linking using gl.bindAttribLocation(). */
//     readonly attributes?: readonly string[]; // The names of the vertex attributes to be bound using gl.bindAttribLocation().
//     /** The names of the shader uniform blocks to be bound prior to linking using gl.uniformBlockBinding(), in the order which they appear */
//     readonly uniformBufferBlocks?: readonly string[];
//     /** Texture uniforms to be bound post-linking. */
//     readonly textureUniforms?: readonly string[]; // Texture uniforms will be bound to the index in which they appear in the name array.
//     /** Transform feedback buffers to be bound post-linking. */
//     readonly transformFeedback?: {
//         /** Should output attributes be written into a single interleaved buffer or separate buffers? */
//         readonly bufferMode: "INTERLEAVED_ATTRIBS" | "SEPARATE_ATTRIBS";
//         /** Name of output attribute names (varyings). */
//         readonly varyings: readonly string[];
//     };
// }

/** @internal */
interface AsyncProgramInfo {
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
