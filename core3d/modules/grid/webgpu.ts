import { type RenderContextWebGPU } from "core3d/webgpu";
import type { RenderModuleContext, RenderModule } from "../webgpu";
import { glUBOProxy, type UniformTypes } from "webgl2";
import type { DerivedRenderState } from "core3d";
import { mat4, vec3 } from "gl-matrix";

/** @internal */
export class GridModule implements RenderModule {
    readonly kind = "grid";
    readonly uniforms = {
        origin: "vec3",
        axisX: "vec3",
        axisY: "vec3",
        size1: "float",
        size2: "float",
        color1: "vec3",
        color2: "vec3",
        distance: "float",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContextWebGPU) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new GridModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContextWebGPU, uniformsProxy: Uniforms) {
        const { shader } = context.imports.shadersWGSL.grid.render;
        const bin = context.resourceBin("Grid");
        const uniformsStaging = bin.createBuffer({
            label: "Grid uniforms staging buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        });
        const uniforms = bin.createBuffer({
            label: "Grid uniforms buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const shaderModule = bin.createShaderModule({
            label: "Grid shader module",
            code: shader,
        });
        const pipeline = await bin.createRenderPipelineAsync({
            label: "Grid pipeline",
            layout: "auto",
            vertex: {
                module: shaderModule,
                entryPoint: "vertexMain",
            },
            fragment: {
                module: shaderModule,
                entryPoint: "fragmentMain",
                targets: [{
                    format: context.buffers.textures.colorMSAA?.format ?? context.buffers.textures.color.format,
                    blend: {
                        color: {
                            srcFactor: "src-alpha",
                            dstFactor: "one-minus-src-alpha",
                        },
                        alpha: {
                            srcFactor: "zero",
                            dstFactor: "one"
                        }
                    }
                }]
            },
            depthStencil: {
                depthWriteEnabled: false,
                format: context.buffers.textures.depth.format,
                depthCompare: "less-equal",
            },
        });
        return { bin, uniformsStaging, uniforms, pipeline } as const;
    }
}

type Uniforms = ReturnType<GridModule["createUniforms"]>;
type Resources = Awaited<ReturnType<GridModule["createResources"]>>;

class GridModuleContext implements RenderModuleContext {
    bindGroup: GPUBindGroup;

    constructor(readonly context: RenderContextWebGPU, readonly module: GridModule, readonly uniforms: Uniforms, readonly resources: Resources) {
        this.bindGroup = this.createBindGroup()
    }

    createBindGroup() {
        const { context, resources } = this;
        const { bin, pipeline } = resources;
        return bin.createBindGroup({
            label: "Grid bind group",
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: context.cameraUniforms! }
                },
                {
                    binding: 1,
                    resource: { buffer: resources.uniforms },
                }
            ]
        });
    }

    async update(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources } = this;
        const { uniformsStaging, uniforms } = resources;
        const { grid, localSpaceTranslation } = state;
        if (context.hasStateChanged({ grid, localSpaceTranslation })) {
            const { values } = this.uniforms;
            const { axisX, axisY, origin } = grid;
            const worldLocalMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), localSpaceTranslation));
            values.origin = vec3.transformMat4(vec3.create(), origin, worldLocalMatrix);
            values.axisX = axisX;
            values.axisY = axisY;
            values.color1 = grid.color1;
            values.color2 = grid.color2;
            values.size1 = grid.size1;
            values.size2 = grid.size2;
            values.distance = grid.distance;
            context.updateUniformBuffer(encoder, uniformsStaging, uniforms, this.uniforms);
        }
    }

    render(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources, bindGroup } = this;
        const { pipeline, uniforms } = resources;
        const { cameraUniforms } = context;

        if (state.grid.enabled) {
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.buffers.colorRenderAttachment(),
                    loadOp: "load",
                    storeOp: "store",
                }],
                depthStencilAttachment: {
                    view: context.buffers.depthRenderAttachment(),
                    depthLoadOp: "load",
                    depthStoreOp: "discard"
                }
            });

            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup)
            pass.draw(3);
            pass.end();

            // TODO: This is not really rendering yet but probably add timers to the command buffer
            // context.addRenderStatistics(stats);
        }
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}