import type { ResourceBin } from "./resource";

export const enum BufferFlags {
    color = 0x01,
    pick = 0x02,
    depth = 0x04,
    all = color | pick | depth,
};

/*
pick buffer layout
  object_id: u32
  normal: 3 x f16
  deviation: f16
  linear_depth f32
*/


/**
 * Set of buffers uses for rendering and pick.
 * @remarks
 * These buffers are only useful for advanced developers who aim to extend this API with their own custom 3D module.
 * @category Render Module
 */
export class RenderBuffers {
    /** Flag to indicate the CPU/read buffers needs to be updated. */
    readBuffersNeedUpdate = true;
    /** Texture resources. */
    readonly textures;
    /** TextureView resources. */
    readonly textureViews;
    /** CPU/JS copy of pick buffers. */
    readonly readBuffers;
    // readonly pipelines;
    private typedArrays;
    //TODO
    // private pickFence: {
    //     readonly sync: WebGLSync,
    //     readonly promises: { readonly resolve: () => void, readonly reject: (reason: string) => void }[],
    // } | undefined;

    /** @internal */
    constructor(
        /** The underlying webgpu device. */
        readonly device: GPUDevice,
        /** The buffer width in pixels. */
        readonly width: number,
        /** The buffer height in pixels. */
        readonly height: number,
        /** # of MSAA samples. */
        readonly samples: number,
        /** The resource bin to manage resource tracking and disposal. */
        readonly resourceBin: ResourceBin
    ) {
        // TODO: is COPY_DST correct to resolve msaa into non msaa?
        // TODO: pick and depth probably need some other usage, also texture_binding? storage?
        const textures = this.textures = {
            color: resourceBin.createTexture({
                label: "Color buffer",
                dimension: "2d",
                size: {width, height},
                // format: "rg11b10ufloat", // TODO: Not supported as render attachment
                format: "rgba16float",
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            }),
            pick: resourceBin.createTexture({
                label: "Pick buffer",
                dimension: "2d",
                size: {width, height},
                format: "rgba32uint",
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
             }), // TODO: Pack linearDepth into this buffer instead.
            depth: resourceBin.createTexture({
                label: "Depth buffer",
                dimension: "2d",
                size: {
                    width,
                    height
                },
                format: "depth32float",
                usage: samples > 1 ? GPUTextureUsage.TEXTURE_BINDING : GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            }),
            colorMSAA: samples > 1 ? resourceBin.createTexture({
                label: "MSAA color buffer",
                // format: "rg11b10ufloat", // TODO: Not supported as render attachment
                format: "rgba16float",
                size: {width, height},
                sampleCount: samples,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            }) : null,
            depthMSAA: samples > 1 ? resourceBin.createTexture({
                label: "MSAA depth buffer",
                format: "depth32float",
                size: {width, height},
                sampleCount: samples,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            }) : null,
        } as const;

        this.textureViews = {
            color: textures.color.createView({
                label: "Color view",
            }),
            pick: textures.pick.createView({
                label: "Pick view"
            }),
            depth: textures.depth.createView({
                label: "Depth view"
            }),
            colorMSAA: textures.colorMSAA?.createView({
                label: "Color MSAA view"
            }),
            depthMSAA: textures.depthMSAA?.createView({
                label: "Depth MSAA view"
            })
        }

        this.readBuffers = {
            pick: resourceBin.createBuffer({
                label: "Pick read buffer",
                size: width * height * 16,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
            }),
        } as const;

        // this.pipelines = {
        //     normal: resourceBin.createRenderPipeline({
        //         label: "MSAA render pipeline",
        //         layout: pipelineLayout,
        //         primitive: primitiveState,
        //         vertex: vertexState,
        //         fragment: fragmentState,
        //         depthStencil: depthStencilState,
        //         multisample: {
        //             count: 1
        //         }
        //     }),

        //     msaa: resourceBin.createRenderPipeline({
        //         label: "MSAA render pipeline",
        //         layout: pipelineLayout,
        //         primitive: primitiveState,
        //         vertex: vertexState,
        //         fragment: fragmentState,
        //         depthStencil: depthStencilState,
        //         multisample: {
        //             count: samples
        //         }
        //     })
        // }

        this.typedArrays = {
            pick: new Uint32Array(width * height * 4),
        } as const;
    }

    colorRenderAttachment() : GPUTextureView {
        if (this.samples > 1) {
            return this.textureViews.colorMSAA!;
        }else{
            return this.textureViews.color;
        }
    }

    depthRenderAttachment() : GPUTextureView {
        if (this.samples > 1) {
            return this.textureViews.depthMSAA!;
        }else{
            return this.textureViews.depth;
        }
    }

    colorResolveAttachment() : GPUTextureView | undefined {
        if (this.samples > 1) {
            return this.textureViews.color;
        }else{
            return undefined;
        }
    }

    depthResolveAttachment() : GPUTextureView | undefined {
        if (this.samples > 1) {
            return this.textureViews.color;
        }else{
            return undefined;
        }
    }

    /** @internal */
    resolveMSAA(encoder: GPUCommandEncoder) {
        const { textureViews } = this;
        const {colorMSAA, color, depthMSAA, depth} = textureViews;
        if (colorMSAA && depthMSAA) {
            // TODO: Missing depth resolve. There's no direct way to do it in webgpu
            // probably needs to be done explicitly through a shader, maybe compute?
            const pass = encoder.beginRenderPass({
                label: "Resolve color MSAA Pass",
                colorAttachments: [
                    {
                        view: colorMSAA,
                        resolveTarget: color,
                        loadOp: "load",
                        storeOp: "store",
                    },
                ]
            });

            pass.end();
        }
    }

    /** @internal */
    // invalidate(frameBuffer: keyof RenderBuffers["frameBuffers"], buffers: BufferFlags) {
    //     const { gl, frameBuffers } = this;
    //     var color = (buffers & BufferFlags.color) != 0;
    //     var pick = (buffers & BufferFlags.pick) != 0;
    //     var depth = (buffers & BufferFlags.depth) != 0;
    //     glInvalidateFrameBuffer(gl, { kind: "DRAW_FRAMEBUFFER", frameBuffer: frameBuffers[frameBuffer], color: [color, pick], depth });
    // }

    /** @internal */
    async pickBuffers() {
        if (this.readBuffersNeedUpdate) {
            const { device, textures, readBuffers } = this;
            const encoder = device.createCommandEncoder();
            encoder.copyTextureToBuffer(
                { texture: textures.pick },
                { buffer: readBuffers.pick },
                { width: textures.pick.width, height: textures.pick.height }
            );
            device.queue.submit([encoder.finish()]);

            await readBuffers.pick.mapAsync(GPUMapMode.READ);
            const data = readBuffers.pick.getMappedRange();

            // The original doesn't seem to use the typedArrays at all
            this.typedArrays.pick.set(new Uint32Array(data));

            readBuffers.pick.unmap();
        }

        return this.typedArrays
    }

    /** @internal */
    dispose() {
        this.resourceBin.dispose();
    }
}
