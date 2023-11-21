import type { RenderBuffers, RenderContextWebGPU, ResourceBin } from "core3d/webgpu";
import type { RenderModuleContext, RenderModule } from "../webgpu";
import { glUBOProxy, type UniformTypes } from "webgl2";
import type { DerivedRenderState } from "core3d";


export const USE_COMPUTE = false;

function createBindGroup(bin: ResourceBin, pipeline: GPUPipelineBase, uniforms: GPUBuffer, outputTexture: GPUTexture | undefined) {
    if (outputTexture) {
        return bin.createBindGroup({
            label: "Tone mapping bind group",
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniforms }
                },
                {
                    binding: 1,
                    resource: outputTexture.createView()
                }
            ]
        })
    }else{
        return bin.createBindGroup({
            label: "Tone mapping bind group",
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniforms }
                }
            ]
        })
    }
}

function createTextureBindGroup(bin: ResourceBin, pipeline: GPUPipelineBase, buffers: RenderBuffers) {
    return bin.createBindGroup({
        label: "Tone mapping textures bind group",
        layout: pipeline.getBindGroupLayout(1),
        entries: [
            {
                binding: 0,
                resource: buffers.textureViews.color
            },
            {
                binding: 1,
                resource: buffers.textureViews.pick
            },
            {
                binding: 2,
                resource: buffers.textureViews.depth
            }
        ]
    })
}

/** @internal */
export class TonemapModule implements RenderModule {
    readonly kind = "tonemap";
    readonly uniforms = {
        exposure: "float",
        mode: "uint",
        maxLinearDepth: "float",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContextWebGPU) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new TonemapModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContextWebGPU, uniformsProxy: Uniforms) {
        const shaders = context.imports.shadersWGSL.tonemap;
        const bin = context.resourceBin("Tonemap");
        const uniformsStaging = bin.createBuffer({
            label: "Tonemapping uniforms staging buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        });
        const uniforms = bin.createBuffer({
            label: "Tonemapping uniforms buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const shaderModule = bin.createShaderModule({
            label: "Tonemapping shader module",
            code: shaders.render.shader,
        });
        let pipeline;
        let intermediateTexture;
        if(USE_COMPUTE) {
            pipeline = bin.createComputePipeline({
                label: "Tonemapping pipeline",
                layout: "auto",
                compute: {
                    module: shaderModule,
                    entryPoint: "computeMain",
                },
            });
            intermediateTexture = bin.createTexture({
                label: "Tonemapping render attachment",
                format: "rgba8unorm",
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
                size: [context!.context!.getCurrentTexture().width, context!.context!.getCurrentTexture().height],
                dimension: "2d",
            });
        }else{
            pipeline = await bin.createRenderPipelineAsync({
                label: "Tonemapping pipeline",
                layout: "auto",
                vertex: {
                    module: shaderModule,
                    entryPoint: "vertexMain",
                },
                fragment: {
                    module: shaderModule,
                    entryPoint: "fragmentMain",
                    targets: [{
                        format: context.canvasFormat()
                    }]
                },
            });
        }

        const bindGroup = createBindGroup(bin, pipeline, uniforms, intermediateTexture);
        const texturesBindGroup = createTextureBindGroup(bin, pipeline, context.buffers);
        return { bin, uniformsStaging, uniforms, pipeline, bindGroup, texturesBindGroup, intermediateTexture };
    }
}

type Uniforms = ReturnType<TonemapModule["createUniforms"]>;
type Resources = Awaited<ReturnType<TonemapModule["createResources"]>>;

class TonemapModuleContext implements RenderModuleContext {

    constructor(readonly context: RenderContextWebGPU, readonly module: TonemapModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    async update(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources } = this;
        const { uniformsStaging, uniforms, pipeline, intermediateTexture, bin } = resources
        const { camera, tonemapping } = state;

        if (context.hasStateChanged({ camera, tonemapping })) {
            const { camera, tonemapping } = state;
            const { values } = this.uniforms;
            values.exposure = Math.pow(2, tonemapping.exposure);
            values.mode = tonemapping.mode;
            values.maxLinearDepth = camera.far;
            await context.updateUniformBuffer(encoder, uniformsStaging, uniforms, this.uniforms);
        }
        const canvasTexture = context!.context!.getCurrentTexture();
        if(intermediateTexture && (canvasTexture.width != intermediateTexture.width || canvasTexture.height != intermediateTexture.height)) {
            resources.intermediateTexture = bin.createTexture({
                label: "Tonemapping render attachment",
                format: "rgba8unorm",
                usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
                size: [context!.context!.getCurrentTexture().width, context!.context!.getCurrentTexture().height],
                dimension: "2d",
            });
            resources.bindGroup = createBindGroup(bin, pipeline, uniforms, resources.intermediateTexture);
        }
        if (context.buffersChanged()) {
            resources.texturesBindGroup = createTextureBindGroup(bin, pipeline, context.buffers);
        }
    }

    render(encoder: GPUCommandEncoder) {
        const { context, buffers } = this.context;
        const { pipeline, bindGroup, texturesBindGroup, intermediateTexture } = this.resources;

        buffers.resolveMSAA(encoder);

        if(pipeline instanceof GPUComputePipeline) {
            const pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.setBindGroup(1, texturesBindGroup);
            pass.dispatchWorkgroups(buffers.textures.color.width, buffers.textures.color.height);
            pass.end();

            encoder.copyTextureToTexture(
                {
                    texture: intermediateTexture!,
                },
                {
                    texture: context!.getCurrentTexture(),
                },
                [intermediateTexture!.width, intermediateTexture!.height, intermediateTexture!.depthOrArrayLayers]
            );
        }else{
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context!.getCurrentTexture().createView(),
                    loadOp: "clear",
                    storeOp: "store",
                }],
            })

            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.setBindGroup(1, texturesBindGroup);
            pass.draw(3);
            pass.end();
        }



        // TODO: This is not really rendering yet but probably add timers to the command buffer
        // context.addRenderStatistics(stats);
    }

    contextLost() {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}
