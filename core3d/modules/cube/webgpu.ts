import { ResourceBin, type RenderContextWebGPU, RenderBuffers } from "core3d/webgpu";
import type { RenderModuleContext, RenderModule } from "../webgpu";
import { glUBOProxy, type UniformTypes } from "webgl2";
import type { DerivedRenderState } from "core3d";
import { mat4, vec3, vec4 } from "gl-matrix";
import { axisVertices, createIndices, createTriplets, createVertices } from "./common";

async function createRenderOrPickPipeline(bin: ResourceBin, shaderModule: GPUShaderModule, layout: GPUVertexBufferLayout, buffers: RenderBuffers, pick: boolean) {
    return await bin.createRenderPipelineAsync({
        label: "Cube render pipeline",
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [layout]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: buffers.textures.color.format,
            }],
            constants: {
                0: pick ? 1 : 0,
            }
        },
        multisample: {
            count: buffers.samples
        },
        primitive: {
            frontFace: "ccw",
            cullMode: "none",
        },
        depthStencil: {
            depthWriteEnabled: true,
            format: buffers.textures.depth.format,
            depthCompare: "less"
        }
    });
}

async function createRenderPipeline(bin: ResourceBin, shaderModule: GPUShaderModule, layout: GPUVertexBufferLayout, buffers: RenderBuffers) {
    return await createRenderOrPickPipeline(bin, shaderModule, layout, buffers, false);
}

async function createPickPipeline(bin: ResourceBin, shaderModule: GPUShaderModule, layout: GPUVertexBufferLayout, buffers: RenderBuffers) {
    return await createRenderOrPickPipeline(bin, shaderModule, layout, buffers, true);
}

async function createAxisPipeline(bin: ResourceBin, shaderModule: GPUShaderModule, layout: GPUVertexBufferLayout, buffers: RenderBuffers) {
    return await bin.createRenderPipelineAsync({
        label: "Axis render pipeline",
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [layout]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: buffers.textures.color.format,
            }],
            constants: {
                0: 0, // pick: false
            }
        },
        multisample: {
            count: buffers.samples
        },
        primitive: {
            topology: "line-list"
        }
    });
}

async function createLinesPipeline(bin: ResourceBin, shaderModule: GPUShaderModule, linesLayout: GPUVertexBufferLayout, opacityLayout: GPUVertexBufferLayout, buffers: RenderBuffers) {
    return await bin.createRenderPipelineAsync({
        label: "Cube lines pipeline",
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [linesLayout, opacityLayout]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: buffers.textures.color.format,
            }],
        },
        multisample: {
            count: buffers.samples
        },
        primitive: {
            topology: "line-list"
        }
    });
}

/** @internal */
export class CubeModule implements RenderModule {
    readonly kind = "cube";
    readonly cubeUniforms = {
        modelLocalMatrix: "mat4",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContextWebGPU) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new CubeModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.cubeUniforms);
    }

    async createResources(context: RenderContextWebGPU, uniformsProxy: Uniforms) {
        const shaders = context.imports.shadersWGSL.cube;
        const vertices = createVertices((pos, norm, col) => ([...pos, ...norm, ...col]));
        const pos = createVertices((pos) => (pos));
        const indices = createIndices();
        const triplets = createTriplets(pos, indices);

        const bin = context.resourceBin("Cube");
        const uniformsStaging = bin.createBuffer({
            label: "Cube uniforms staging buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        });
        const uniforms = bin.createBuffer({
            label: "Cube uniforms buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const vb_render = createVertexBuffer(bin, vertices, "Cube vertices buffer");
        const ib_render = createIndexBuffer(bin, indices, "Cube indices buffer");
        const renderLayout: GPUVertexBufferLayout = {
            arrayStride: 36,
            attributes: [{
                format: "float32x3",
                offset: 0,
                shaderLocation: 0, // position
            },
            {
                format: "float32x3",
                offset: 12,
                shaderLocation: 1, // normal
            },
            {
                format: "float32x3",
                offset: 24,
                shaderLocation: 2, // color
            }],
        };

        const renderShaderModule = bin.createShaderModule({
            label: "Cube render shader module",
            code: shaders.render.shader,
        });
        const renderPipeline = await createRenderPipeline(bin, renderShaderModule, renderLayout, context.buffers);
        const renderBindGroup = bin.createBindGroup({
            label: "Cube render bind group",
            layout: renderPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: context.cameraUniforms! }
                },
                {
                    binding: 1,
                    resource: { buffer: context.clippingUniforms! }
                },
                {
                    binding: 2,
                    resource: { buffer: uniforms }
                },
            ]
        });

        const axis_vb = createVertexBuffer(bin, axisVertices(), "Axis vertices buffer");
        const axisPipeline = await createAxisPipeline(bin, renderShaderModule, renderLayout, context.buffers);


        const pickShaderModule = bin.createShaderModule({
            label: "Cube pick shader module",
            code: shaders.render.shader,
        });
        const pickPipeline = await createPickPipeline(bin, pickShaderModule, renderLayout, context.buffers);
        const pickBindGroup = bin.createBindGroup({
            label: "Cube pick bind group",
            layout: renderPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: context.cameraUniforms! }
                },
                {
                    binding: 1,
                    resource: { buffer: context.clippingUniforms! }
                },
                {
                    binding: 2,
                    resource: { buffer: uniforms }
                },
            ]
        });

        const vb_line = bin.createBuffer({
            label: "Cube line buffer",
            size: 12 * 2 * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE
        });
        const vb_opacity = bin.createBuffer({
            label: "Cube opacity buffer",
            size: 12 * 4,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE
        });
        const linesLayout: GPUVertexBufferLayout = {
            arrayStride: 8,
            attributes: [
                {
                    format: "float16x4",
                    offset: 0,
                    shaderLocation: 0, // positions
                },
            ],
            stepMode: "instance",
        };
        const opacityLayout: GPUVertexBufferLayout = {
            arrayStride: 4,
            attributes: [
                {
                    format: "float32",
                    offset: 0,
                    shaderLocation: 1, // opacity
                }
            ],
            stepMode: "instance",
        };
        const linesShaderModule = bin.createShaderModule({
            label: "Cube lines shader module",
            code: shaders.line.shader,
        });
        const linesPipeline = await createLinesPipeline(bin, linesShaderModule, linesLayout, opacityLayout, context.buffers);
        const linesBindGroup = bin.createBindGroup({
            label: "Cube lines bind group",
            layout: linesPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: context.cameraUniforms! }
                },
                {
                    binding: 1,
                    resource: { buffer: context.clippingUniforms! }
                },
                {
                    binding: 2,
                    resource: { buffer: context.outlineUniforms! }
                },
            ]
        });



        const vb_triplets = bin.createBuffer({
            label: "Cube triplets buffer",
            size: triplets.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        context.device?.queue.writeBuffer(vb_triplets, 0, triplets);

        const tripletsShaderModule = bin.createShaderModule({
            label: "Cube triplets shader module",
            code: shaders.intersect.shader,
        });
        const tripletsPipeline = bin.createComputePipeline({
            label: "Cube triplets compute pipeline",
            compute: {
                module: tripletsShaderModule,
                entryPoint: "main"
            },
            layout: "auto",
        });

        const tripletsBindGroup = bin.createBindGroup({
            layout: tripletsPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: uniforms }
                },
                {
                    binding: 1,
                    resource: { buffer: context.outlineUniforms! }
                },
                {
                    binding: 2,
                    resource: { buffer: vb_triplets },
                },
                {
                    binding: 3,
                    resource: { buffer: vb_line },
                },
                {
                    binding: 4,
                    resource: { buffer: vb_opacity },
                }
            ]
        });

        return {
            bin,
            uniformsStaging,
            uniforms,
            vb_render,
            ib_render,
            renderPipeline,
            renderBindGroup,
            renderLayout,
            renderShaderModule,
            axis_vb,
            axisPipeline,
            pickPipeline,
            pickBindGroup,
            pickShaderModule,
            vb_line,
            vb_opacity,
            linesLayout,
            opacityLayout,
            linesShaderModule,
            linesPipeline,
            linesBindGroup,
            vb_triplets,
            tripletsPipeline,
            tripletsBindGroup,
            numIndices: indices.length,
        };
    }
}

type Uniforms = ReturnType<CubeModule["createUniforms"]>;
type Resources = Awaited<ReturnType<CubeModule["createResources"]>>;

class CubeModuleContext implements RenderModuleContext {
    constructor(readonly context: RenderContextWebGPU, readonly module: CubeModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    async update(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources, uniforms } = this;
        const { cube, localSpaceTranslation } = state;
        if (context.hasStateChanged({ cube, localSpaceTranslation })) {
            const { scale, position } = cube;
            const posLS = vec3.subtract(vec3.create(), position, localSpaceTranslation);
            const m = [
                scale, 0, 0, 0,
                0, scale, 0, 0,
                0, 0, scale, 0,
                ...posLS, 1
            ] as Parameters<typeof mat4.fromValues>;
            uniforms.values.modelLocalMatrix = mat4.fromValues(...m);
            context.updateUniformBuffer(encoder, resources.uniformsStaging, resources.uniforms, uniforms);
        }

        if(context.buffersChanged()) {
            const { bin, renderShaderModule, pickShaderModule, renderLayout, linesShaderModule, linesLayout, opacityLayout } = resources;
            resources.renderPipeline = await createRenderPipeline(bin, renderShaderModule, renderLayout, context.buffers);
            resources.pickPipeline = await createPickPipeline(bin, pickShaderModule, renderLayout, context.buffers);
            resources.axisPipeline = await createAxisPipeline(bin, renderShaderModule, renderLayout, context.buffers);
            resources.linesPipeline = await createLinesPipeline(bin, linesShaderModule, linesLayout, opacityLayout, context.buffers);
        }
    }

    render(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources } = this;
        const { vb_render, ib_render, axis_vb, renderPipeline, renderBindGroup, axisPipeline, numIndices } = resources;
        const { /*outlineUniforms,*/ deviceProfile } = context;

        if (state.cube.enabled) {
            // render normal cube
            if(state.cube.drawCube) {
                const renderPass = encoder.beginRenderPass({
                    colorAttachments: [{
                        view: context.buffers.colorRenderAttachment(),
                        loadOp: "load",
                        storeOp: "store",
                    }],
                    depthStencilAttachment: {
                        view: context.buffers.depthRenderAttachment(),
                        depthLoadOp: "load",
                        depthStoreOp: "store",
                    }
                });

                renderPass.setPipeline(renderPipeline);
                renderPass.setBindGroup(0, renderBindGroup);
                renderPass.setVertexBuffer(0, vb_render);
                renderPass.setIndexBuffer(ib_render, "uint16");
                renderPass.drawIndexed(numIndices);
                renderPass.end();
            }

            // render axis
            if(state.cube.drawAxis) {
                const axisRenderPass = encoder.beginRenderPass({
                    colorAttachments: [{
                        view: context.buffers.colorRenderAttachment(),
                        loadOp: "load",
                        storeOp: "store",
                    }]
                });

                axisRenderPass.setPipeline(axisPipeline);
                axisRenderPass.setBindGroup(0, renderBindGroup);
                axisRenderPass.setVertexBuffer(0, axis_vb);
                axisRenderPass.draw(6);
                axisRenderPass.end();
            }

            // TODO: This is not really rendering yet but probably add timers to the command buffer
            // context.addRenderStatistics(stats);

            if (state.outlines.enabled && deviceProfile.features.outline) {
                const { vb_line, vb_opacity, linesPipeline, linesBindGroup, tripletsPipeline, tripletsBindGroup } = resources;
                const [x, y, z, offset] = state.outlines.plane;
                const plane = vec4.fromValues(x, y, z, -offset);
                const planeIndex = state.clipping.planes.findIndex((cp) => vec4.exactEquals(cp.normalOffset, plane));

                context.updateOutlinesUniforms(encoder, plane, state.outlines.color, planeIndex);

                // transform vertex triplets into intersection lines
                const tripletsPass = encoder.beginComputePass({
                    label: "Triplets compute pass"
                });
                tripletsPass.setPipeline(tripletsPipeline);
                tripletsPass.setBindGroup(0, tripletsBindGroup);
                tripletsPass.dispatchWorkgroups(numIndices)
                tripletsPass.end();



                // render intersection lines
                const linesPass = encoder.beginRenderPass({
                    colorAttachments: [{
                        view: context.buffers.colorRenderAttachment(),
                        loadOp: "load",
                        storeOp: "store",
                    }]
                });

                linesPass.setPipeline(linesPipeline);
                linesPass.setBindGroup(0, linesBindGroup);
                linesPass.setVertexBuffer(0, vb_line);
                linesPass.setVertexBuffer(1, vb_opacity);
                linesPass.draw(2, 12);
                linesPass.end();

                // TODO: This is not really rendering yet but probably add timers to the command buffer
                // context.addRenderStatistics(stats);
            }
        }
    }

    pick(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources } = this;
        const { pickPipeline, pickBindGroup, vb_render, ib_render, numIndices } = resources;

        if (state.cube.enabled) {
            // TODO: render pickable outlines too?
            const renderPass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.buffers.colorRenderAttachment(),
                    loadOp: "load",
                    storeOp: "store",
                }],
                depthStencilAttachment: {
                    view: context.buffers.depthRenderAttachment(),
                    depthLoadOp: "load",
                    depthStoreOp: "store",
                }
            });

            renderPass.setPipeline(pickPipeline);
            renderPass.setBindGroup(0, pickBindGroup);
            renderPass.setVertexBuffer(0, vb_render);
            renderPass.setIndexBuffer(ib_render, "uint16");
            renderPass.drawIndexed(numIndices);
            renderPass.end();
        }
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}


type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;
// type TypedArray = ArrayLike<any> & {
//     BYTES_PER_ELEMENT: number;
//     byteLength: number;
//     set(array: ArrayLike<number>, offset?: number): void;
//     slice(start?: number, end?: number): TypedArray;
// };
// type TypedArrayConstructor<T> = {
//     new (): T;
//     new (size: number): T;
//     new (buffer: ArrayBuffer): T;
//     BYTES_PER_ELEMENT: number;
// }

function createVertexBuffer(bin: ResourceBin, data: TypedArray, label: string): GPUBuffer {
    const vb = bin.createBuffer({
        label,
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        // mappedAtCreation: true,
    });
    // const gpuVertices = new (data.constructor as TypedArrayConstructor<T>)(vb.getMappedRange());
    // gpuVertices.set(data);
    // vb.unmap();

    bin.device.queue.writeBuffer(vb, 0, data);

    return vb;
}

function createIndexBuffer(bin: ResourceBin, data: TypedArray, label: string): GPUBuffer {
    const ib = bin.createBuffer({
        label,
        size: data.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        // mappedAtCreation: true,
    });
    // const gpuIndices = new (data.constructor as TypedArrayConstructor<T>)(ib.getMappedRange());
    // gpuIndices.set(data);
    // ib.unmap();

    bin.device.queue.writeBuffer(ib, 0, data);

    return ib;
}