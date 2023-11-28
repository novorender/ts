import { GPUImageFromTextureParams, ResourceBin, type RenderContextWebGPU, RenderBuffers } from "core3d/webgpu";
import type { RenderModuleContext, RenderModule } from "../webgpu";
import type { DerivedRenderState, RenderStateDynamicGeometry, RenderStateDynamicImage, RenderStateDynamicInstance, RenderStateDynamicMaterial, RenderStateDynamicMeshPrimitive, RenderStateDynamicObject, RenderStateDynamicSampler, RenderStateDynamicTexture, RenderStateDynamicTextureReference, RenderStateDynamicVertexAttribute } from "core3d";
import { glUBOProxy, type UniformTypes, type WrapString } from "webgl2";
import { mat4, vec3, type ReadonlyVec3 } from "gl-matrix";

/** @internal */
export class DynamicModule implements RenderModule {
    readonly kind = "dynamic";
    readonly materialUniforms = {
        baseColor: "vec4",
    } as const satisfies Record<string, UniformTypes>;

    readonly instanceUniforms = {
        modelViewMatrix: "mat4",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContextWebGPU) {
        const resources = await this.createResources(context);
        return new DynamicModuleContext(context, this, resources);
    }

    async createResources(context: RenderContextWebGPU) {
        const { shader } = context.imports.shadersWGSL.dynamic.render;
        const bin = context.resourceBin("Dynamic");
        const defaultSamplers = {
            mip: bin.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "repeat", addressModeV: "repeat" }),
            plain: bin.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "repeat", addressModeV: "repeat" }),
        } as const;
        // TODO: Is his needed on webgpu?
        const defaultTexture = bin.createTextureFromImage({
            descriptor: {
                label: "Dynamic default texture",
                size: [1, 1],
                format: "rgba8unorm",
                usage: GPUTextureUsage.TEXTURE_BINDING,
            },
            data: new Uint8Array([0, 0, 0, 0])
        }); // used to avoid warnings on android

        const shaderModule = bin.createShaderModule({
            label: "Dynamic shader module",
            code: shader,

        });

        const cameraLayout = bin.createBindGroupLayout({
            label: "Dynamic module camera layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                }
            ]
        });

        const objectLayout = bin.createBindGroupLayout({
            label: "Dynamic module object layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "uniform" },
                }
            ]
        })

        const materialLayout = bin.createBindGroupLayout({
            label: "Dynamic module material layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                },
                {
                    binding: 3,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        viewDimension: "cube"
                    }
                },
                {
                    binding: 4,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                },
                {
                    binding: 5,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        viewDimension: "cube"
                    }
                },
                {
                    binding: 6,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                },
                {
                    binding: 7,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {
                    binding: 8,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                },
                {
                    binding: 9,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {
                    binding: 10,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                },
                {
                    binding: 11,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {
                    binding: 12,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                },
                {
                    binding: 13,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {
                    binding: 14,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                },
                {
                    binding: 15,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {}
                },
                {
                    binding: 16,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: "filtering" }
                }
            ]
        });

        // TODO: Is it worth reusing a camera bindgroup for all modules?
        const cameraBindGroup = bin.createBindGroup({
            label: "Dynamic module camera bind group",
            layout: cameraLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: context.cameraUniforms! }
                }
            ]
        })

        const emptyBuffer = bin.createBuffer({
            label: "Dynamic module empty buffer",
            size: 0,
            usage: GPUBufferUsage.VERTEX,
        });

        return { bin, defaultSamplers, defaultTexture, shaderModule, cameraBindGroup, emptyBuffer, cameraLayout, objectLayout, materialLayout } as const;
    }
}

type Resources = Awaited<ReturnType<DynamicModule["createResources"]>>;
type DefaultSamplers = Resources["defaultSamplers"];

interface ObjectGeometryMaterialGroup {
    readonly material: MaterialAsset;
    readonly geometry: GeometryAsset;
    readonly object: ObjectAsset;
    pipeline: GPURenderPipeline,
}

const blend: GPUBlendState = {
    color: {
        srcFactor: "src-alpha",
        dstFactor: "one-minus-src-alpha",
    },
    alpha: {
        srcFactor: "zero",
        dstFactor: "one",
    },
};

async function createMeshPipeline(material: RenderStateDynamicMaterial, geometry: GeometryAsset, bin: ResourceBin, shaderModule: GPUShaderModule, buffers: RenderBuffers, bindGroupLayouts: GPUBindGroupLayout[]) {
    // TODO: cache pipelines and bindgroups. Pipeline key is
    // RenderStateDynamicMaterial + geometry layouts as bool, has that attr or not,
    // the format should be the same per format
    const {resources} = geometry;
    return await bin.createRenderPipelineAsync({
        label: "Dynamic pipeline",
        layout: bin.createPipelineLayout({
            label: "Dynamic pipeline layout",
            bindGroupLayouts,
        }),
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
            buffers: [
                resources.position.layout,
                resources.normal.layout,
                resources.tangent.layout,
                resources.color0.layout,
                resources.texCoord0.layout,
                resources.texCoord1.layout,
                {
                    arrayStride: 4*12,
                    attributes: [
                        {
                            format: "float32x3",
                            offset: 4*3*0,
                            shaderLocation: 6
                        },
                        {
                            format: "float32x3",
                            offset: 4*3*1,
                            shaderLocation: 7
                        },
                        {
                            format: "float32x3",
                            offset: 4*3*2,
                            shaderLocation: 8
                        },
                        {
                            format: "float32x3",
                            offset: 4*3*3,
                            shaderLocation: 9
                        },
                    ],
                    stepMode: "instance"
                }
            ]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: buffers.textures.color.format,
                blend: material.alphaMode == "BLEND" ? blend : undefined,
            }],
            constants: {
                0: material.kind =="ggx" ? 1 : 0, // PBR_METALLIC_ROUGHNESS
            }
        },
        primitive: {
            frontFace: "ccw",
            cullMode: material.doubleSided ? "none" : "back",
        },
        multisample: {
            count: buffers.samples,
        },
        depthStencil: {
            depthWriteEnabled: true,
            format: buffers.textures.depth.format,
            depthCompare: "less-equal",
        }
    })
}

function vertexBufferLayoutToString(layout: GPUVertexBufferLayout): string {
    const attrs = Array.from(layout.attributes)
        .map((attr) => (`${attr.format}_${attr.offset}_${attr.shaderLocation}`))
        .join();
    return `${layout.arrayStride}_[${attrs}]`;
}

class DynamicModuleContext implements RenderModuleContext {
    iblTextures;
    readonly buffers = new Map<BufferSource, BufferAsset>();
    readonly geometries = new Map<RenderStateDynamicGeometry, GeometryAsset>();
    readonly objects = new Map<RenderStateDynamicObject, ObjectAsset>();
    readonly materials = new Map<RenderStateDynamicMaterial, MaterialAsset>();
    readonly images = new Map<RenderStateDynamicImage, TextureAsset>();
    readonly samplers = new Map<RenderStateDynamicSampler, SamplerAsset>();
    readonly pipelines = new Map<string, GPURenderPipeline>();
    meshes: ObjectGeometryMaterialGroup[] = [];

    constructor(readonly context: RenderContextWebGPU, readonly module: DynamicModule, readonly resources: Resources) {
        this.iblTextures = context.iblTextures;
    }

    async update(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources } = this;
        const { bin, defaultSamplers, defaultTexture, shaderModule, cameraLayout, objectLayout, materialLayout } = resources;
        const { dynamic, localSpaceTranslation } = state;
        if (context.hasStateChanged({ dynamic })) {
            // synchronizing assets by reference is slower than array indexing, but it makes the render state safer and simpler to modify.
            // performance should not be a major issue for < 1000 objects or so, however.
            function* getTextures(material: RenderStateDynamicMaterial) {
                const { baseColorTexture } = material;
                if (baseColorTexture)
                    yield baseColorTexture.texture;
                if (material.kind == "ggx") {
                    const { emissiveTexture, metallicRoughnessTexture, normalTexture, occlusionTexture } = material;
                    if (emissiveTexture)
                        yield emissiveTexture.texture;
                    if (metallicRoughnessTexture)
                        yield metallicRoughnessTexture.texture;
                    if (normalTexture)
                        yield normalTexture.texture;
                    if (occlusionTexture)
                        yield occlusionTexture.texture;
                }
            }
            const primitives = [...new Set<RenderStateDynamicMeshPrimitive>(dynamic.objects.flatMap(o => o.mesh.primitives))];
            const geometries = [...new Set<RenderStateDynamicGeometry>(primitives.map(p => p.geometry))];
            const materials = [...new Set<RenderStateDynamicMaterial>(primitives.map(p => p.material))];
            const textures = [...new Set<RenderStateDynamicTexture>(materials.flatMap(m => [...getTextures(m)]))];
            const images = [...new Set<RenderStateDynamicImage>(textures.map(t => t.image))];
            const samplers = [...new Set<RenderStateDynamicSampler>(textures.map(t => t.sampler!).filter(s => s))];
            const objects = [...new Set<RenderStateDynamicObject>(dynamic.objects.map(o => o))];
            const vertexBuffers = new Set<BufferSource>(geometries.flatMap(g => [...Object.values(g.attributes).map((a: RenderStateDynamicVertexAttribute) => a.buffer).filter(b => b)]));
            const indexBuffers = new Set<BufferSource>(geometries.map(g => typeof g.indices == "number" ? undefined : g.indices).filter(b => b) as BufferSource[]);
            const numVertexBuffers = vertexBuffers.size;
            const buffers = [...vertexBuffers, ...indexBuffers];
            syncAssets(bin, buffers, this.buffers, (data, idx) => new BufferAsset(bin, "Dynamic vertex/index buffer", (idx < numVertexBuffers ? GPUBufferUsage.VERTEX : GPUBufferUsage.INDEX) | GPUBufferUsage.COPY_DST, data));
            syncAssets(bin, images, this.images, data => new TextureAsset(bin, data));
            syncAssets(bin, samplers, this.samplers, data => new SamplerAsset(bin, data));
            syncAssets(bin, geometries, this.geometries, data => new GeometryAsset(bin, data, this.buffers));
            syncAssets(bin, objects, this.objects, data => new ObjectAsset(bin, context, data, state, objectLayout));
            syncAssets(bin, materials, this.materials, data => new MaterialAsset(bin, context, data, this.images, this.samplers, defaultTexture, defaultSamplers, materialLayout));

            const layouts = [cameraLayout, objectLayout, materialLayout];
            this.meshes = [];
            const { pipelines, meshes } = this;
            const usedPipelines = new Set<string>;
            // TODO: Await all pipelines at once
            for (const obj of state.dynamic.objects) {
                const objAsset = this.objects.get(obj)!;
                for (const primitive of obj.mesh.primitives) {
                    const geometry = this.geometries.get(primitive.geometry)!;
                    const material = this.materials.get(primitive.material)!;
                    let pipeline = pipelines.get(geometry.key);
                    if(!pipeline) {
                        pipeline = await createMeshPipeline(primitive.material, geometry, bin, shaderModule, context.buffers, layouts);
                        pipelines.set(geometry.key, pipeline);
                    }

                    meshes.push({material, geometry, object: objAsset, pipeline});
                    usedPipelines.add(geometry.key);
                }
            }

            for(const [key, pipeline] of pipelines) {
                if(!usedPipelines.has(key)) {
                    bin.delete(pipeline);
                    pipelines.delete(key)
                }
            }

            // sort by material and then object
            meshes.sort((a, b) => {
                let diff = a.material.index - b.material.index;
                if (diff == 0) {
                    diff = a.object.index - b.object.index;
                }
                return diff;
            })
        }
        if (context.hasStateChanged({ localSpaceTranslation })) {
            // TODO: Do we really need to use Array.from?
            await Promise.all(Array.from(this.objects.values()).map((instance) => (instance.update(encoder, context, state))));
        }
        if (context.iblTextures != this.iblTextures) {
            this.iblTextures = context.iblTextures;
            // TODO: Do we really need to use Array.from?
            await Promise.all(Array.from(this.materials.values()).map((material) => (material.update(encoder, context, defaultTexture))));
        }
    }

    render(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources } = this;
        const { cameraBindGroup, emptyBuffer } = resources;

        const { geometries, meshes } = this;
        let numPrimitives = 0;
        state.dynamic.objects.forEach((p => { numPrimitives += p.mesh.primitives.length }));
        if (numPrimitives != geometries.size) {// happens to objects that are deleted the next frame when using pickbuffers as they are using previous state.
            return;
        }

        const renderPassDescriptor: GPURenderPassDescriptor = {
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
        };

        let currentMaterial: MaterialAsset = undefined!;
        let currentObject: ObjectAsset = undefined!;


        for (const { material, object, geometry, pipeline } of meshes) {
            if(!material.bindGroup) {
                continue
            }

            const pass = encoder.beginRenderPass(renderPassDescriptor);

            if (currentMaterial != material) {
                currentMaterial = material;
                // gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, material.uniformsBuffer);
                // glState(gl, currentMaterial.stateParams);
            }

            if (currentObject != object) {
                currentObject = object;
                // gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, object.uniformsBuffer);
            }

            // TODO: We need to set the bindgroups for every object, maybe explore bundles?
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, cameraBindGroup);
            pass.setBindGroup(1, object.bindGroup);
            pass.setBindGroup(2, material.bindGroup);
            pass.setVertexBuffer(0, geometry.resources.position.buffer ?? emptyBuffer);
            pass.setVertexBuffer(1, geometry.resources.normal.buffer ?? emptyBuffer);
            pass.setVertexBuffer(2, geometry.resources.tangent.buffer ?? emptyBuffer);
            pass.setVertexBuffer(3, geometry.resources.color0.buffer ?? emptyBuffer);
            pass.setVertexBuffer(4, geometry.resources.texCoord0.buffer ?? emptyBuffer);
            pass.setVertexBuffer(5, geometry.resources.texCoord1.buffer ?? emptyBuffer);
            pass.setVertexBuffer(6, object.instancesBuffer);
            if(geometry.resources.indices) {
                pass.setIndexBuffer(geometry.resources.indices, geometry.drawParams.indexType!);
                pass.drawIndexed(geometry.drawParams.count, object.numInstances);
            }else{
                pass.draw(geometry.drawParams.count, object.numInstances);
            }

            pass.end();

            // TODO
            // context.addRenderStatistics(stats);
        }
    }

    pick(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        this.render(encoder, state); // TODO: make separate program for pick buffers instead of relying on drawbuffers
    }

    contextLost(): void {
    }

    dispose() {
        const { resources, buffers, geometries, materials, objects } = this;
        const { bin, cameraBindGroup, shaderModule, defaultSamplers, defaultTexture } = resources;
        this.contextLost();
        const assets = [...buffers.values(), ...geometries.values(), ...materials.values(), ...objects.values()];
        for (const asset of assets) {
            asset.dispose(bin);
        }
        bin.delete(cameraBindGroup, shaderModule, defaultSamplers.mip, defaultSamplers.plain, defaultTexture);
        console.assert(bin.size == 0);
        bin.dispose();
        buffers.clear();
        geometries.clear();
        materials.clear();
        objects.clear();
    }
}

function syncAssets<TK, TV extends { index: number, dispose(bin: ResourceBin): void }>(bin: ResourceBin, uniqueResources: Iterable<TK>, map: Map<TK, TV>, create: (resource: TK, index: number) => TV) {
    // delete unreferenced resources
    const unreferenced = new Map<TK, TV>(map);
    for (const resource of uniqueResources) {
        unreferenced.delete(resource);
    }
    for (const [resource, asset] of unreferenced) {
        map.delete(resource);
        asset.dispose(bin);
    }

    // index and create new resources
    let idx = 0;
    for (const resource of uniqueResources) {
        let asset = map.get(resource);
        if (!asset) {
            asset = create(resource, idx);
            map.set(resource, asset);
        }
        asset.index = idx++;
    }
}

class BufferAsset {
    index = 0;
    readonly buffer: GPUBuffer;

    constructor(bin: ResourceBin, label: string, usage: GPUFlagsConstant, srcData: BufferSource) {
        this.buffer = bin.createBuffer({ label, usage, size: srcData.byteLength });
        bin.device.queue.writeBuffer(this.buffer, 0, srcData);
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.buffer);
    }
}

class GeometryAsset {
    index = 0;
    readonly drawParams;
    readonly resources;
    readonly key;

    constructor(bin: ResourceBin, data: RenderStateDynamicGeometry, buffers: Map<BufferSource, BufferAsset>) {
        const hasIndexBuffer = typeof data.indices != "number";
        const indexType: GPUIndexFormat | undefined = !hasIndexBuffer ? undefined : data.indices instanceof Uint32Array ? "uint32" : "uint16";
        const mode = data.primitiveType;
        const count = hasIndexBuffer ? data.indices.length : data.indices;
        this.drawParams = { mode, count, indexType };
        const { position, normal, tangent, color0, texCoord0, texCoord1 } = data.attributes;
        const indices = typeof data.indices == "number" ? null : bin.createBuffer({
            label: "Dynamic index buffer",
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
            size: data.indices.byteLength
        });
        if(indices && typeof data.indices != "number"){
            bin.device.queue.writeBuffer(indices, 0, data.indices);
        }

        function vertexFormatStride(f: GPUVertexFormat) {
            switch(f) {
                case "float16x2": return 2 * 2;
                case "float16x4": return 2 * 4;
                case "float32":   return 4 * 1;
                case "float32x2": return 4 * 2;
                case "float32x3": return 4 * 3;
                case "float32x4": return 4 * 4;
                case "sint16x2":  return 2 * 2;
                case "sint16x4":  return 2 * 4;
                case "sint32":    return 4 * 1;
                case "sint32x2":  return 4 * 2;
                case "sint32x3":  return 4 * 3;
                case "sint32x4":  return 4 * 4;
                case "sint8x2":   return 1 * 2;
                case "sint8x4":   return 1 * 4;
                case "snorm16x2": return 2 * 2;
                case "snorm16x4": return 2 * 4;
                case "snorm8x2":  return 1 * 2;
                case "snorm8x4":  return 1 * 4;
                case "uint16x2":  return 2 * 2;
                case "uint16x4":  return 2 * 4;
                case "uint32":    return 4 * 1;
                case "uint32x2":  return 4 * 2;
                case "uint32x3":  return 4 * 3;
                case "uint32x4":  return 4 * 4;
                case "uint8x2":   return 1 * 2;
                case "uint8x4":   return 1 * 4;
                case "unorm16x2": return 2 * 2;
                case "unorm16x4": return 2 * 4;
                case "unorm8x2":  return 1 * 2;
                case "unorm8x4":  return 1 * 4;
                case "unorm10-10-10-2": return 4;
            }
        }

        function parseLayoutFormat(a: RenderStateDynamicVertexAttribute | undefined, shaderLocation: number): GPUVertexBufferLayout | null {
            if(!a) return null;

            let format: GPUVertexFormat;
            switch (a.componentType ?? "FLOAT") {
                case "BYTE":
                    switch (a.componentCount) {
                        case 1:
                        case 3: throw "Not supported";

                        case 2:
                            format = "sint8x2";
                            break;
                        case 4:
                            format = "sint8x4";
                            break;
                    }
                break;
                case "UNSIGNED_BYTE":
                    switch (a.componentCount) {
                        case 1:
                        case 3: throw "Not supported";

                        case 2:
                            format = "uint8x2";
                            break;
                        case 4:
                            format = "uint8x4";
                            break;
                    }
                break;
                case "FLOAT":
                    switch (a.componentCount) {
                        case 1:
                            format = "float32";
                            break;
                        case 2:
                            format = "float32x2";
                            break;
                        case 3:
                            format = "float32x3";
                            break;
                        case 4:
                            format = "float32x4";
                            break;
                    }
                break;
                case "HALF_FLOAT":
                    switch (a.componentCount) {
                        case 1:
                        case 3: throw "Not supported";
                        case 2:
                            format = "float16x2";
                            break;
                        case 4:
                            format = "float16x4";
                            break;
                    }
                break;
                case "INT":
                    switch (a.componentCount) {
                        case 1:
                            format = "sint32";
                            break;
                        case 2:
                            format = "sint32x2";
                            break;
                        case 3:
                            format = "sint32x3";
                            break;
                        case 4:
                            format = "sint32x4";
                            break;
                    }
                case "UNSIGNED_INT":
                    switch (a.componentCount) {
                        case 1:
                            format = "uint32";
                            break;
                        case 2:
                            format = "uint32x2";
                            break;
                        case 3:
                            format = "uint32x3";
                            break;
                        case 4:
                            format = "uint32x4";
                            break;
                    }
                case "SHORT":
                    switch (a.componentCount) {
                        case 1:
                        case 3: throw "Not supported";
                        case 2:
                            format = "sint16x2";
                            break;
                        case 4:
                            format = "sint16x4";
                            break;
                    }
                case "UNSIGNED_SHORT":
                    switch (a.componentCount) {
                        case 1:
                        case 3: throw "Not supported";
                        case 2:
                            format = "uint16x2";
                            break;
                        case 4:
                            format = "uint16x4";
                            break;
                    }

                default: throw "Unrecheable"
            }

            return {
                arrayStride: a.byteStride ?? vertexFormatStride(format!),
                attributes: [{
                    format: format!,
                    offset: a.byteOffset ?? 0,
                    shaderLocation
                }],
                stepMode: "vertex"
            };
        }
        this.resources = {
            position: {
                buffer: buffers.get(position.buffer)?.buffer ?? null,
                layout: parseLayoutFormat(position, 0),
            },
            normal: {
                buffer: normal ? buffers.get(normal.buffer)?.buffer ?? null : null,
                layout: parseLayoutFormat(normal, 1) ?? {
                    arrayStride: vertexFormatStride("float32x3"),
                    attributes: [{
                        format: "float32x3",
                        offset: 0,
                        shaderLocation: 1,
                    }],
                    stepMode: "vertex"
                },
            },
            tangent: {
                buffer: tangent ? buffers.get(tangent.buffer)?.buffer ?? null : null,
                layout: parseLayoutFormat(tangent, 2) ?? {
                    arrayStride: vertexFormatStride("float32x4"),
                    attributes: [{
                        format: "float32x4",
                        offset: 0,
                        shaderLocation: 2,
                    }],
                    stepMode: "vertex"
                },
            },
            color0: {
                buffer: color0 ? buffers.get(color0.buffer)?.buffer ?? null : null,
                layout: parseLayoutFormat(color0, 3) ?? {
                    arrayStride: vertexFormatStride("float32x4"),
                    attributes: [{
                        format: "float32x4",
                        offset: 0,
                        shaderLocation: 3,
                    }],
                    stepMode: "vertex"
                },
            },
            texCoord0: {
                buffer: texCoord0 ? buffers.get(texCoord0.buffer)?.buffer ?? null : null,
                layout: parseLayoutFormat(texCoord0, 4) ?? {
                    arrayStride: vertexFormatStride("float32x2"),
                    attributes: [{
                        format: "float32x2",
                        offset: 0,
                        shaderLocation: 4,
                    }],
                    stepMode: "vertex"
                },
            },
            texCoord1: {
                buffer: texCoord1 ? buffers.get(texCoord1.buffer)?.buffer ?? null : null,
                layout: parseLayoutFormat(texCoord1, 5) ?? {
                    arrayStride: vertexFormatStride("float32x2"),
                    attributes: [{
                        format: "float32x2",
                        offset: 0,
                        shaderLocation: 5,
                    }],
                    stepMode: "vertex"
                },
            },
            indices: indices
        } as const;

        {
            const {position, normal, color0, texCoord0, texCoord1, tangent} = this.resources;
            const positionKey = vertexBufferLayoutToString(position.layout!);
            let normalKey;
            if (normal.layout) {
                normalKey = vertexBufferLayoutToString(normal.layout)
            }
            let color0Key;
            if (color0.layout) {
                color0Key = vertexBufferLayoutToString(color0.layout)
            }
            let texCoord0Key;
            if (texCoord0.layout) {
                texCoord0Key = vertexBufferLayoutToString(texCoord0.layout)
            }
            let texCoord1Key;
            if (texCoord1.layout) {
                texCoord1Key = vertexBufferLayoutToString(texCoord1.layout)
            }
            let tangentKey;
            if (tangent.layout) {
                tangentKey = vertexBufferLayoutToString(tangent.layout)
            }
            this.key = `${positionKey}_${normalKey}_${color0Key}_${texCoord0Key}_${texCoord1Key}_${tangentKey}`;
        }
    }

    dispose(bin: ResourceBin) {
        bin.delete(
            this.resources.position.buffer,
            this.resources.normal.buffer,
            this.resources.tangent.buffer,
            this.resources.color0.buffer,
            this.resources.texCoord0.buffer,
            this.resources.texCoord1.buffer,
            this.resources.indices,
        );
    }
}

class ObjectAsset {
    index = 0;
    private readonly uniforms;

    readonly numInstances: number;
    readonly uniformsBuffer: GPUBuffer;
    readonly instancesBuffer: GPUBuffer;
    readonly uniformsStagingBuffer: GPUBuffer;
    readonly instancesStagingBuffer: GPUBuffer;
    readonly bindGroup: GPUBindGroup;

    constructor(bin: ResourceBin, context: RenderContextWebGPU, readonly data: RenderStateDynamicObject, state: DerivedRenderState, layout: GPUBindGroupLayout) {
        const uniformsDesc = {
            worldLocalMatrix: "mat4",
            baseObjectId: "uint",
        } as const satisfies Record<string, UniformTypes>;
        this.uniforms = glUBOProxy(uniformsDesc);
        const { values } = this.uniforms;
        values.baseObjectId = data.baseObjectId ?? 0xffffffff;
        this.uniformsStagingBuffer = bin.createBuffer({
            label: "Object uniforms staging buffer",
            size: this.uniforms.buffer.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        });
        this.uniformsBuffer = bin.createBuffer({
            label: "Object uniforms buffer",
            size: this.uniforms.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        context.device?.queue.writeBuffer(this.uniformsBuffer, 0, this.uniforms.buffer);
        const { instances } = data;
        this.numInstances = instances.length;
        const srcData = ObjectAsset.computeInstanceMatrices(instances, state.localSpaceTranslation);
        this.instancesStagingBuffer = bin.createBuffer({
            label: "Object instance matrix staging buffer",
            size: srcData.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        });
        this.instancesBuffer = bin.createBuffer({
            label: "Object instance matrix buffer",
            size: srcData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        context.device?.queue.writeBuffer(this.instancesBuffer, 0, srcData);

        this.bindGroup = bin.createBindGroup({
            layout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformsBuffer },
                }
            ]
        });

        // TODO we don't have the encoder here, we can get it from the device but is it really needed?
        // update should be called right after on the first frame
        // this.update(context, state);
    }

    static computeInstanceMatrices(instances: readonly RenderStateDynamicInstance[], localSpaceTranslation: ReadonlyVec3) {
        const srcData = new Float32Array(instances.length * 12);
        for (let i = 0; i < instances.length; i++) {
            const { position, rotation, scale } = instances[i];
            const translatedPos = vec3.sub(vec3.create(), position, localSpaceTranslation);
            const transform = rotation ? mat4.fromRotationTranslation(mat4.create(), rotation, translatedPos) : mat4.fromTranslation(mat4.create(), translatedPos);
            const [e00, e01, e02, e03, e10, e11, e12, e13, e20, e21, e22, e23, e30, e31, e32, e33] = transform;
            const elems4x3 = [e00, e01, e02, e10, e11, e12, e20, e21, e22, e30, e31, e32];
            if (scale != undefined) {
                for (let i = 0; i < 9; i++) { // don't scale translation
                    elems4x3[i] *= scale;
                }
            }
            srcData.set(elems4x3, i * elems4x3.length);
        }
        return srcData;
    }

    async update(encoder: GPUCommandEncoder, context: RenderContextWebGPU, state: DerivedRenderState) {
        const { uniforms, uniformsStagingBuffer, uniformsBuffer, data, instancesStagingBuffer, instancesBuffer } = this;
        const { localSpaceTranslation } = state;
        const { values } = uniforms;
        values.worldLocalMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), state.localSpaceTranslation));

        if (context.hasStateChanged({ localSpaceTranslation })) {
            const srcData = ObjectAsset.computeInstanceMatrices(data.instances, localSpaceTranslation);
            await context.updateBuffer(encoder, instancesStagingBuffer, instancesBuffer, srcData);
        }

        await context.updateUniformBuffer(encoder, uniformsStagingBuffer, uniformsBuffer, uniforms);
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.uniformsBuffer);
    }
}

type TextureNames = "baseColor" | "emissive" | "normal" | "occlusion" | "metallicRoughness";

class MaterialAsset {
    index = 0;
    readonly kind;
    readonly uniforms;
    bindGroup: GPUBindGroup | undefined;
    readonly uniformsBuffer;
    readonly uniformsStagingBuffer;
    readonly textures = {} as { [P in TextureNames]?: GPUTexture };
    readonly samplers = {} as { [P in TextureNames]?: GPUSampler };

    constructor(
        readonly bin: ResourceBin,
        context: RenderContextWebGPU,
        data: RenderStateDynamicMaterial,
        textures: Map<RenderStateDynamicImage, TextureAsset>,
        samplers: Map<RenderStateDynamicSampler, SamplerAsset>,
        defaultTexture: GPUTexture,
        defaultSamplers: DefaultSamplers,
        readonly layout: GPUBindGroupLayout
    ) {
        if(!context.iblTextures) {
            throw "iblTextures not initialized yet"
        }
        this.kind = data.kind;
        const uniformsDesc = {
            baseColorFactor: "vec4",
            emissiveFactor: "vec3",
            roughnessFactor: "float",
            metallicFactor: "float",
            normalScale: "float",
            occlusionStrength: "float",
            alphaCutoff: "float",
            baseColorUVSet: "int",
            metallicRoughnessUVSet: "int",
            normalUVSet: "int",
            occlusionUVSet: "int",
            emissiveUVSet: "int",
            radianceMipCount: "uint",
        } as const satisfies Record<string, UniformTypes>;
        const uniformsProxy = this.uniforms = glUBOProxy(uniformsDesc);
        let tex = this.textures;
        let samp = this.samplers;
        const { values } = uniformsProxy;
        const { baseColorTexture } = data;
        values.baseColorFactor = data.baseColorFactor ?? [1, 1, 1, 1];
        values.baseColorUVSet = data.baseColorTexture ? data.baseColorTexture.texCoord ?? 0 : -1;
        values.alphaCutoff = data.alphaCutoff ?? data.alphaMode == "MASK" ? .5 : 0;
        values.radianceMipCount = context.iblTextures.numMipMaps;

        function getDefaultSampler(texRef: RenderStateDynamicTextureReference | undefined) {
            if (texRef) {
                return isImagePowerOfTwo(texRef.texture.image) ? defaultSamplers.mip : defaultSamplers.plain;
            }
        }

        if (baseColorTexture) {
            tex.baseColor = textures.get(baseColorTexture.texture.image)!.texture;
            samp.baseColor = samplers.get(baseColorTexture.texture.sampler!)?.sampler ?? getDefaultSampler(baseColorTexture);
        }
        if (data.kind == "ggx") {
            const { roughnessFactor, metallicFactor, emissiveFactor, emissiveTexture, normalTexture, occlusionTexture, metallicRoughnessTexture } = data;
            values.roughnessFactor = roughnessFactor ?? 1;
            values.metallicFactor = metallicFactor ?? 1;
            values.emissiveFactor = emissiveFactor ?? [0, 0, 0];
            values.metallicRoughnessUVSet = metallicRoughnessTexture ? metallicRoughnessTexture.texCoord ?? 0 : -1;
            values.normalUVSet = normalTexture ? normalTexture.texCoord ?? 0 : -1;
            values.normalScale = normalTexture?.scale ?? 1;
            values.occlusionUVSet = occlusionTexture ? occlusionTexture.texCoord ?? 0 : -1;
            values.occlusionStrength = occlusionTexture?.strength ?? 1;
            values.emissiveUVSet = emissiveTexture ? emissiveTexture.texCoord ?? 0 : -1;
            if (emissiveTexture) {
                tex.emissive = textures.get(emissiveTexture.texture.image)!.texture;
                samp.emissive = samplers.get(emissiveTexture.texture.sampler!)?.sampler ?? getDefaultSampler(emissiveTexture);
            }
            if (normalTexture) {
                tex.normal = textures.get(normalTexture.texture.image)!.texture;
                samp.normal = samplers.get(normalTexture.texture.sampler!)?.sampler ?? getDefaultSampler(normalTexture);
            }
            if (occlusionTexture) {
                tex.occlusion = textures.get(occlusionTexture.texture.image)!.texture;
                samp.occlusion = samplers.get(occlusionTexture.texture.sampler!)?.sampler ?? getDefaultSampler(occlusionTexture);
            }
            if (metallicRoughnessTexture) {
                tex.metallicRoughness = textures.get(metallicRoughnessTexture.texture.image)!.texture;
                samp.metallicRoughness = samplers.get(metallicRoughnessTexture.texture.sampler!)?.sampler ?? getDefaultSampler(metallicRoughnessTexture);
            }
        } else {
            values.roughnessFactor = 1;
            values.metallicFactor = 1;
            values.emissiveFactor = [0, 0, 0];
            values.metallicRoughnessUVSet = -1;
            values.normalUVSet = -1;
            values.normalScale = 0;
            values.occlusionUVSet = -1;
            values.occlusionStrength = 0;
            values.emissiveUVSet = -1;
        }

        this.uniformsStagingBuffer = bin.createBuffer({
            label: "Cube uniforms buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        });
        this.uniformsBuffer = bin.createBuffer({
            label: "Cube uniforms buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        context.device?.queue.writeBuffer(this.uniformsBuffer, 0, uniformsProxy.buffer);

        // TODO we don't have the encoder here, we can get it from the device but is it really needed?
        // update should be called right after on the first frame
        // this.update(encoder, context, defaultTexture)
    }

    async update(encoder: GPUCommandEncoder, context: RenderContextWebGPU, defaultTexture: GPUTexture) {
        const { iblTextures, lut_ggx, samplerSingle, samplerMip } = context;
        const { bin, uniforms, uniformsStagingBuffer, uniformsBuffer, textures, samplers, layout } = this;
        if(!lut_ggx || !iblTextures) {
            return;
        }
        const { diffuse, specular, numMipMaps } = iblTextures;
        if (!this.bindGroup) {
            this.bindGroup = bin.createBindGroup({
                label: "Dynamic material bindGroup",
                layout,
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: uniformsBuffer }
                    },
                    {
                        binding: 1,
                        resource: lut_ggx.createView(),
                    },
                    {
                        binding: 2,
                        resource: samplerSingle!
                    },
                    {
                        binding: 3,
                        resource: diffuse.createView({ dimension: "cube" })
                    },
                    {
                        binding: 4,
                        resource: samplerMip!
                    },
                    {
                        binding: 5,
                        resource: specular.createView({ dimension: "cube" })
                    },
                    {
                        binding: 6,
                        resource: samplerMip!
                    },
                    {
                        binding: 7,
                        resource: textures.baseColor?.createView() ?? defaultTexture.createView()
                    },
                    {
                        binding: 8,
                        resource: samplers.baseColor ?? samplerSingle!
                    },
                    {
                        binding: 9,
                        resource: textures.metallicRoughness?.createView() ?? defaultTexture.createView()
                    },
                    {
                        binding: 10,
                        resource: samplers.metallicRoughness ?? samplerSingle!
                    },
                    {
                        binding: 11,
                        resource: textures.normal?.createView() ?? defaultTexture.createView()
                    },
                    {
                        binding: 12,
                        resource: samplers.normal ?? samplerSingle!
                    },
                    {
                        binding: 13,
                        resource: textures.emissive?.createView() ?? defaultTexture.createView()
                    },
                    {
                        binding: 14,
                        resource: samplers.emissive ?? samplerSingle!
                    },
                    {
                        binding: 15,
                        resource: textures.occlusion?.createView() ?? defaultTexture.createView()
                    },
                    {
                        binding: 16,
                        resource: samplers.occlusion ?? samplerSingle!
                    }
                ]
            });
        }
        uniforms.values.radianceMipCount = numMipMaps;
        context.updateUniformBuffer(encoder, uniformsStagingBuffer, uniformsBuffer, uniforms);
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.uniformsBuffer);
    }
}

class TextureAsset {
    index = 0;
    readonly texture: GPUTexture;

    constructor(bin: ResourceBin, image: RenderStateDynamicImage) {
        this.texture = bin.createTextureFromImage(GPUImageFromTextureParams(image.params, GPUTextureUsage.TEXTURE_BINDING));
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.texture);
    }
}

function addressModeFromGL(wrap: WrapString | undefined) {
    if(wrap) {
        switch (wrap) {
            case "CLAMP_TO_EDGE": return "clamp-to-edge";
            case "REPEAT": return "repeat";
            case "MIRRORED_REPEAT": return "mirror-repeat";
        }
    }else{
        return undefined;
    }
}

class SamplerAsset {
    index = 0;
    readonly sampler: GPUSampler;

    constructor(bin: ResourceBin, sampler: RenderStateDynamicSampler) {
        this.sampler = bin.createSampler({
            minFilter: sampler.minificationFilter == "LINEAR" || sampler.minificationFilter == "LINEAR_MIPMAP_LINEAR" || sampler.minificationFilter == "LINEAR_MIPMAP_NEAREST" ? "linear" : "nearest",
            magFilter: sampler.magnificationFilter == "LINEAR" ? "linear" : "nearest",
            mipmapFilter: sampler.minificationFilter == "LINEAR_MIPMAP_LINEAR" || sampler.minificationFilter == "NEAREST_MIPMAP_LINEAR" ? "linear" : "nearest",
            addressModeU: addressModeFromGL(sampler.wrap?.[0]),
            addressModeV: addressModeFromGL(sampler.wrap?.[1]),
        });
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.sampler);
    }
}

function isImagePowerOfTwo(image: RenderStateDynamicImage) {
    function isPowerOf2(value: number) {
        return (value & (value - 1)) == 0;
    }
    const { width, height } = image.params;
    return isPowerOf2(width) && isPowerOf2(height);
}