import type { RenderBuffers, RenderContextWebGPU, ResourceBin } from "core3d/webgpu";
import type { RenderModuleContext, RenderModule } from "../webgpu";
import { glUBOProxy, type UniformTypes } from "webgl2";
import type { DerivedRenderState } from "core3d";

function createBindGroup(bin: ResourceBin, pipeline: GPURenderPipeline, buffers: RenderBuffers, uniforms: GPUBuffer) {
    return bin.createBindGroup({
        label: "Tone mapping bind group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: buffers.textureViews.color
            },
            {
                binding: 1,
                resource: { buffer: uniforms }
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
        const { shader } = context.imports.shadersWGSL.tonemap.render;
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

        const sampler = bin.createSampler({
            label: "Tone mapping color texture sampler",
            minFilter: "nearest",
            magFilter: "nearest",
            addressModeU: "clamp-to-edge",
            addressModeV: "clamp-to-edge"
        });

        const shaderModule = bin.createShaderModule({
            label: "Tonemapping shader module",
            code: shader,
        });
        const pipeline = await bin.createRenderPipelineAsync({
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

        const bindGroup = createBindGroup(bin, pipeline, context.buffers, uniforms);
        return { bin, uniformsStaging, uniforms, sampler, pipeline, bindGroup };
    }
}

type Uniforms = ReturnType<TonemapModule["createUniforms"]>;
type Resources = Awaited<ReturnType<TonemapModule["createResources"]>>;

class TonemapModuleContext implements RenderModuleContext {

    constructor(readonly context: RenderContextWebGPU, readonly module: TonemapModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    async update(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources } = this;
        const { uniformsStaging, uniforms, pipeline, sampler } = resources
        const { camera, tonemapping } = state;

        if (context.hasStateChanged({ camera, tonemapping })) {
            const { camera, tonemapping } = state;
            const { values } = this.uniforms;
            values.exposure = Math.pow(2, tonemapping.exposure);
            values.mode = tonemapping.mode;
            values.maxLinearDepth = camera.far;
            await context.updateUniformBuffer(encoder, uniformsStaging, uniforms, this.uniforms);
            resources.bindGroup = createBindGroup(resources.bin, pipeline, context.buffers, uniforms);
        }
    }

    render(encoder: GPUCommandEncoder) {
        const { context } = this.context;
        const { pipeline, bindGroup } = this.resources;
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                // TODO: Is this a performance problem? Cache the view?
                view: context!.getCurrentTexture().createView(),
                loadOp: "load",
                storeOp: "store",
            }],
        })

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
        pass.end();

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
