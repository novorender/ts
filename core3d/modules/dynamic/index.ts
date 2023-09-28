import type { DerivedRenderState, RenderContext, RenderStateDynamicGeometry, RenderStateDynamicImage, RenderStateDynamicInstance, RenderStateDynamicMaterial, RenderStateDynamicMeshPrimitive, RenderStateDynamicObject, RenderStateDynamicSampler, RenderStateDynamicTexture, RenderStateDynamicTextureReference, RenderStateDynamicVertexAttribute } from "core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glDraw, glState, type UniformTypes, type VertexArrayParams, type VertexAttribute, type DrawParamsElements, type DrawParamsArrays, type StateParams, type DrawParamsArraysInstanced, type DrawParamsElementsInstanced, glUpdateBuffer } from "webgl2";
import { mat3, mat4, vec3, type ReadonlyVec3 } from "gl-matrix";
import { BufferFlags } from "core3d/buffers";
import { ResourceBin } from "core3d/resource";

/** @internal */
export class DynamicModule implements RenderModule {
    readonly kind = "dynamic";
    readonly materialUniforms = {
        baseColor: "vec4",
    } as const satisfies Record<string, UniformTypes>;

    readonly instanceUniforms = {
        modelViewMatrix: "mat4",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const resources = await this.createResources(context);
        return new DynamicModuleContext(context, this, resources);
    }

    async createResources(context: RenderContext) {
        const { vertexShader, fragmentShader } = context.imports.shaders.dynamic.render;
        const bin = context.resourceBin("Dynamic");
        const defaultSamplers = {
            mip: bin.createSampler({ magnificationFilter: "LINEAR", minificationFilter: "LINEAR_MIPMAP_LINEAR", wrap: ["REPEAT", "REPEAT"] }),
            plain: bin.createSampler({ magnificationFilter: "LINEAR", minificationFilter: "LINEAR", wrap: ["REPEAT", "REPEAT"] }),
        } as const;
        const defaultTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: new Uint8Array(4) }); // used to avoid warnings on android
        const uniformBufferBlocks = ["Camera", "Material", "Object"];
        const textureNames = ["lut_ggx", "ibl.diffuse", "ibl.specular", "base_color", "metallic_roughness", "normal", "emissive", "occlusion"] as const;
        const textureUniforms = textureNames.map(name => `textures.${name}`);

        const [unlit, ggx] = await Promise.all([
            context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks, textureUniforms, header: { flags: context.deviceProfile.quirks.adreno600 ? ["ADRENO600"] : [] } }),
            context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks, textureUniforms, header: { flags: context.deviceProfile.quirks.adreno600 ? ["ADRENO600", "PBR_METALLIC_ROUGHNESS"] : ["PBR_METALLIC_ROUGHNESS"] } }),
        ]);
        const programs = { unlit, ggx };
        return { bin, defaultSamplers, defaultTexture, programs } as const;
    }
}

type Resources = Awaited<ReturnType<DynamicModule["createResources"]>>;
type DefaultSamplers = Resources["defaultSamplers"];

class DynamicModuleContext implements RenderModuleContext {
    iblTextures;
    readonly buffers = new Map<BufferSource, BufferAsset>();
    readonly geometries = new Map<RenderStateDynamicGeometry, GeometryAsset>();
    readonly objects = new Map<RenderStateDynamicObject, ObjectAsset>();
    readonly materials = new Map<RenderStateDynamicMaterial, MaterialAsset>();
    readonly images = new Map<RenderStateDynamicImage, TextureAsset>();
    readonly samplers = new Map<RenderStateDynamicSampler, SamplerAsset>();

    constructor(readonly context: RenderContext, readonly module: DynamicModule, readonly resources: Resources) {
        this.iblTextures = context.iblTextures;
    }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { bin, defaultSamplers, defaultTexture, programs } = resources;
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
            syncAssets(bin, buffers, this.buffers, (data, idx) => new BufferAsset(bin, idx < numVertexBuffers ? "ARRAY_BUFFER" : "ELEMENT_ARRAY_BUFFER", data));
            syncAssets(bin, images, this.images, data => new TextureAsset(bin, data));
            syncAssets(bin, samplers, this.samplers, data => new SamplerAsset(bin, data));
            syncAssets(bin, geometries, this.geometries, data => new GeometryAsset(bin, data, this.buffers));
            syncAssets(bin, objects, this.objects, data => new ObjectAsset(bin, context, data, state));
            syncAssets(bin, materials, this.materials, data => new MaterialAsset(bin, context, data, this.images, this.samplers, defaultTexture, defaultSamplers, programs[data.kind]));
        }
        if (context.hasStateChanged({ localSpaceTranslation })) {
            for (const instance of this.objects.values()) {
                instance.update(context, state);
            }
        }
        if (context.iblTextures != this.iblTextures) {
            this.iblTextures = context.iblTextures;
            for (const material of this.materials.values()) {
                material.update(context, defaultTexture);
            }
        }
    }

    render(state: DerivedRenderState) {
        const { context } = this;
        const { gl, cameraUniforms } = context;

        glState(gl, {
            uniformBuffers: [cameraUniforms],
            depth: {
                test: true,
                writeMask: true,
            },
        });

        const { objects, geometries, materials } = this;
        const meshes: { readonly material: MaterialAsset; readonly geometry: GeometryAsset; readonly object: ObjectAsset }[] = [];
        let numPrimitives = 0;
        state.dynamic.objects.forEach((p => { numPrimitives += p.mesh.primitives.length }));
        if (numPrimitives != geometries.size) {// happens to objects that are deleted the next frame when using pickbuffers as they are using previous state.
            return;
        }
        for (const obj of state.dynamic.objects) {
            const objAsset = objects.get(obj)!;
            for (const primitive of obj.mesh.primitives) {
                const geometry = geometries.get(primitive.geometry)!;
                const material = materials.get(primitive.material)!;
                meshes.push({ material, geometry, object: objAsset });
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

        // vertex attribute defaults
        gl.vertexAttrib4f(3, 1, 1, 1, 1); // color0

        let currentMaterial: MaterialAsset = undefined!;
        let currentObject: ObjectAsset = undefined!;

        for (const { material, object, geometry } of meshes) {

            if (currentMaterial != material) {
                currentMaterial = material;
                gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, material.uniformsBuffer);
                glState(gl, currentMaterial.stateParams);
            }
            if (currentObject != object) {
                currentObject = object;
                gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, object.uniformsBuffer);
            }
            gl.bindVertexArray(geometry.resources.vao);
            // TODO: create an geometry+instances VAO?
            gl.bindBuffer(gl.ARRAY_BUFFER, object.instancesBuffer);
            for (let i = 0; i < 4; i++) {
                const attrib = i + VertexAttribs.matrix0;
                gl.vertexAttribPointer(attrib, 3, gl.FLOAT, false, 4 * 12, i * 12);
                gl.vertexAttribDivisor(attrib, 1);
                gl.enableVertexAttribArray(attrib);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            const kind = `${geometry.drawParams.kind}_instanced` as const;
            const params = { ...geometry.drawParams, kind, instanceCount: object.numInstances } as (DrawParamsArraysInstanced | DrawParamsElementsInstanced);
            const stats = glDraw(gl, params);
            gl.bindVertexArray(null);
            context.addRenderStatistics(stats);
        }

        for (let i = 0; i < 4; i++) {
            const attrib = i + VertexAttribs.matrix0;
            gl.disableVertexAttribArray(attrib);
        }
    }

    pick(state: DerivedRenderState) {
        this.render(state); // TODO: make separate program for pick buffers instead of relying on drawbuffers
    }

    contextLost(): void {
    }

    dispose() {
        const { resources, buffers, geometries, materials, objects } = this;
        const { bin, programs, defaultSamplers, defaultTexture } = resources;
        this.contextLost();
        const assets = [...buffers.values(), ...geometries.values(), ...materials.values(), ...objects.values()];
        for (const asset of assets) {
            asset.dispose(bin);
        }
        bin.delete(programs.unlit, programs.ggx, defaultSamplers.mip, defaultSamplers.plain, defaultTexture);
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
    readonly buffer: WebGLBuffer;

    constructor(bin: ResourceBin, kind: "ARRAY_BUFFER" | "ELEMENT_ARRAY_BUFFER", srcData: BufferSource) {
        this.buffer = bin.createBuffer({ kind, srcData });
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.buffer);
    }
}

const enum VertexAttribs {
    position,
    normal,
    tangent,
    color0,
    texCoord0,
    texCoord1,
    matrix0,
    matrix1,
    matrix2,
    matrix3,
}

class GeometryAsset {
    index = 0;
    readonly drawParams: DrawParamsElements | DrawParamsArrays;
    readonly resources;

    constructor(bin: ResourceBin, data: RenderStateDynamicGeometry, buffers: Map<BufferSource, BufferAsset>) {
        const hasIndexBuffer = typeof data.indices != "number";
        const indexType = !hasIndexBuffer ? undefined : data.indices instanceof Uint32Array ? "UNSIGNED_INT" : data.indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_BYTE";
        const mode = data.primitiveType;
        const count = hasIndexBuffer ? data.indices.length : data.indices;
        this.drawParams = { kind: hasIndexBuffer ? "elements" : "arrays", mode, count, indexType: indexType } as DrawParamsElements | DrawParamsArrays;
        const { position, normal, tangent, color0, texCoord0, texCoord1 } = data.attributes;
        function convAttr(a: RenderStateDynamicVertexAttribute | undefined) {
            if (!a)
                return null;
            const { buffer } = buffers.get(a.buffer)!;
            return { ...a, buffer } as VertexAttribute;
        }
        const indices = typeof data.indices == "number" ? undefined : bin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: data.indices });
        const params: VertexArrayParams = {
            attributes: [
                convAttr(position),
                convAttr(normal),
                convAttr(tangent),
                convAttr(color0),
                convAttr(texCoord0),
                convAttr(texCoord1),
            ],
            indices,
        }
        const vao = bin.createVertexArray(params);
        if (indices) {
            bin.subordinate(vao, indices);
        }
        this.resources = { vao } as const;
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.resources.vao);
    }
}

class ObjectAsset {
    index = 0;
    private readonly uniforms;

    readonly numInstances: number;
    readonly uniformsBuffer: WebGLBuffer;
    readonly instancesBuffer: WebGLBuffer;

    constructor(bin: ResourceBin, context: RenderContext, readonly data: RenderStateDynamicObject, state: DerivedRenderState) {
        const uniformsDesc = {
            worldLocalMatrix: "mat4",
            baseObjectId: "uint",
        } as const satisfies Record<string, UniformTypes>;
        this.uniforms = glUBOProxy(uniformsDesc);
        const { values } = this.uniforms;
        values.baseObjectId = data.baseObjectId ?? 0xffffffff;
        this.uniformsBuffer = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: this.uniforms.buffer });
        const { instances } = data;
        this.numInstances = instances.length;
        this.instancesBuffer = ObjectAsset.createInstancesBuffer(bin, instances, state.localSpaceTranslation);
        this.update(context, state);
    }

    static createInstancesBuffer(bin: ResourceBin, instances: readonly RenderStateDynamicInstance[], localSpaceTranslation: ReadonlyVec3) {
        const srcData = ObjectAsset.computeInstanceMatrices(instances, localSpaceTranslation);
        return bin.createBuffer({ kind: "ARRAY_BUFFER", srcData });
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

    update(context: RenderContext, state: DerivedRenderState) {
        const { uniforms, uniformsBuffer, data, instancesBuffer } = this;
        const { localSpaceTranslation } = state;
        const { values } = uniforms;
        values.worldLocalMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), state.localSpaceTranslation));

        if (context.hasStateChanged({ localSpaceTranslation })) {
            const srcData = ObjectAsset.computeInstanceMatrices(data.instances, localSpaceTranslation);
            glUpdateBuffer(context.gl, { kind: "ARRAY_BUFFER", srcData, targetBuffer: instancesBuffer });
        }

        context.updateUniformBuffer(uniformsBuffer, uniforms);
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
    readonly stateParams: StateParams;
    readonly uniformsBuffer;
    readonly textures = {} as { [P in TextureNames]?: WebGLTexture };
    readonly samplers = {} as { [P in TextureNames]?: WebGLSampler };

    constructor(
        bin: ResourceBin,
        context: RenderContext,
        data: RenderStateDynamicMaterial,
        textures: Map<RenderStateDynamicImage, TextureAsset>,
        samplers: Map<RenderStateDynamicSampler, SamplerAsset>,
        defaultTexture: WebGLTexture,
        defaultSamplers: DefaultSamplers,
        program: DynamicModuleContext["resources"]["programs"]["ggx"],
    ) {
        this.kind = data.kind;
        const blend = {
            enable: true,
            srcRGB: "SRC_ALPHA",
            dstRGB: "ONE_MINUS_SRC_ALPHA",
            srcAlpha: "ZERO",
            dstAlpha: "ONE",
        } as const satisfies StateParams["blend"];
        this.stateParams = {
            program,
            cull: { enable: data.doubleSided ? false : true },
            blend: (data.alphaMode == "BLEND" ? blend : undefined),
            // drawBuffers: context.drawBuffers(data.alphaMode == "BLEND" ? BufferFlags.color : BufferFlags.all), // for devices without OES_draw_buffers_indexed support
        };
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
        this.uniformsBuffer = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
        this.update(context, defaultTexture)
    }

    update(context: RenderContext, defaultTexture: WebGLTexture) {
        const { iblTextures, lut_ggx, samplerSingle, samplerMip } = context;
        const { uniforms, uniformsBuffer, textures, samplers } = this;
        const { diffuse, specular, numMipMaps } = iblTextures;
        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const mutableState = this.stateParams as Mutable<StateParams>;
        mutableState.textures = [
            { kind: "TEXTURE_2D", texture: lut_ggx, sampler: samplerSingle },
            { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerSingle },
            { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip },
            { kind: "TEXTURE_2D", texture: textures.baseColor ?? defaultTexture, sampler: samplers.baseColor ?? null },
            { kind: "TEXTURE_2D", texture: textures.metallicRoughness ?? defaultTexture, sampler: samplers.metallicRoughness ?? null },
            { kind: "TEXTURE_2D", texture: textures.normal ?? defaultTexture, sampler: samplers.normal ?? null },
            { kind: "TEXTURE_2D", texture: textures.emissive ?? defaultTexture, sampler: samplers.emissive ?? null },
            { kind: "TEXTURE_2D", texture: textures.occlusion ?? defaultTexture, sampler: samplers.occlusion ?? null },
        ] as const;
        uniforms.values.radianceMipCount = numMipMaps;
        context.updateUniformBuffer(uniformsBuffer, uniforms);
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.uniformsBuffer);
    }
}

class TextureAsset {
    index = 0;
    readonly texture: WebGLTexture;

    constructor(bin: ResourceBin, image: RenderStateDynamicImage) {
        this.texture = bin.createTexture(image.params);
    }

    dispose(bin: ResourceBin) {
        bin.delete(this.texture);
    }
}

class SamplerAsset {
    index = 0;
    readonly sampler: WebGLSampler;

    constructor(bin: ResourceBin, sampler: RenderStateDynamicSampler) {
        this.sampler = bin.createSampler(sampler);
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