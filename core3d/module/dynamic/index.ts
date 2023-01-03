import { DerivedRenderState, RenderContext, RenderStateDynamicGeometry, RenderStateDynamicImage, RenderStateDynamicInstance, RenderStateDynamicMaterial, RenderStateDynamicMesh, RenderStateDynamicMeshPrimitive, RenderStateDynamicObject, RenderStateDynamicSampler, RenderStateDynamicTexture, RenderStateDynamicVertexAttribute } from "core3d";
import { RenderModuleContext, RenderModule } from "..";
import { createUniformsProxy, glBuffer, glProgram, glDraw, glState, glDelete, UniformTypes, glVertexArray, VertexArrayParams, VertexAttribute, DrawParamsElements, DrawParamsArrays, StateParams, glUniformLocations, glTexture, glSampler } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat3, mat4, vec3 } from "gl-matrix";

// TODO: Create (programatically) and render cube
// TODO: Create (from gltf)
export class DynamicModule implements RenderModule {
    readonly materialUniforms = {
        baseColor: "vec4",
    } as const satisfies Record<string, UniformTypes>;

    readonly instanceUniforms = {
        modelViewMatrix: "mat4",
    } as const satisfies Record<string, UniformTypes>;

    withContext(context: RenderContext) {
        return new DynamicModuleContext(context, this);
    }
}

class DynamicModuleContext implements RenderModuleContext {
    iblTextures;
    readonly programs;
    readonly textureUniformLocations;
    readonly buffers = new Map<BufferSource, BufferAsset>();
    readonly geometries = new Map<RenderStateDynamicGeometry, GeometryAsset>();
    readonly instances = new Map<RenderStateDynamicInstance, InstanceAsset>();
    readonly materials = new Map<RenderStateDynamicMaterial, MaterialAsset>();
    readonly images = new Map<RenderStateDynamicImage, TextureAsset>();
    readonly samplers = new Map<RenderStateDynamicSampler, SamplerAsset>();
    readonly defaultTexture: WebGLTexture;
    readonly defaultSampler: WebGLSampler;

    constructor(readonly context: RenderContext, readonly data: DynamicModule) {
        const { gl } = context;
        const uniformBufferBlocks = ["Camera", "Material", "Instance"];

        const unlit = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks });
        const ggx = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks, flags: ["PBR_METALLIC_ROUGHNESS"] });
        this.programs = { unlit, ggx } as const;
        const textureNames = ["ibl_lut_ggx", "ibl_diffuse", "ibl_specular", "base_color", "metallic_roughness", "normal", "emissive", "occlusion"] as const;
        this.textureUniformLocations = {
            unlit: glUniformLocations(gl, unlit, textureNames, "texture_"),
            ggx: glUniformLocations(gl, ggx, textureNames, "texture_"),
        } as const;
        this.defaultSampler = glSampler(gl, { magnificationFilter: "LINEAR", minificationFilter: "LINEAR_MIPMAP_LINEAR", wrap: ["REPEAT", "REPEAT"] });
        this.defaultTexture = glTexture(gl, { kind: "TEXTURE_2D", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: new Uint8Array(4) }); // used to avoid warnings on android
        this.iblTextures = context.iblTextures;
    }

    update(state: DerivedRenderState) {
        const { context, programs, textureUniformLocations } = this;
        const { gl } = context;
        const { dynamic, localSpaceTranslation } = state;
        if (context.hasStateChanged({ dynamic })) {
            // synchronizing assets by reference is slower than array indexing, but it makes the render state safer and simpler to modify.
            // performance should not be a major issue for < 1000 objects or so
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
            const instances = [...new Set<RenderStateDynamicInstance>(dynamic.objects.map(o => o.instance))];
            const vertexBuffers = new Set<BufferSource>(geometries.flatMap(g => [...Object.values(g.attributes).map((a: RenderStateDynamicVertexAttribute) => a.buffer).filter(b => b)]));
            const indexBuffers = new Set<BufferSource>(geometries.map(g => typeof g.indices == "number" ? undefined : g.indices).filter(b => b) as BufferSource[]);
            const numVertexBuffers = vertexBuffers.size;
            const buffers = [...vertexBuffers, ...indexBuffers];
            syncAssets(gl, buffers, this.buffers, (data, idx) => new BufferAsset(gl, idx < numVertexBuffers ? "ARRAY_BUFFER" : "ELEMENT_ARRAY_BUFFER", data));
            syncAssets(gl, images, this.images, data => new TextureAsset(gl, data));
            syncAssets(gl, samplers, this.samplers, data => new SamplerAsset(gl, data));
            syncAssets(gl, geometries, this.geometries, data => new GeometryAsset(gl, data, this.buffers));
            syncAssets(gl, instances, this.instances, data => new InstanceAsset(context, data, state));
            syncAssets(gl, materials, this.materials, data => new MaterialAsset(context, data, this.images, this.samplers, this.defaultTexture, this.defaultSampler, programs[data.kind]));
        }
        if (context.hasStateChanged({ localSpaceTranslation })) {
            for (const instance of this.instances.values()) {
                instance.update(context, state);
            }
        }
        if (context.iblTextures != this.iblTextures) {
            this.iblTextures = context.iblTextures;
            for (const material of this.materials.values()) {
                material.update(context, state, this.defaultTexture, textureUniformLocations[material.kind]);
            }
        }
    }

    render(state: DerivedRenderState) {
        const { context } = this;
        const { gl, cameraUniforms } = context;

        glState(gl, {
            uniformBuffers: [cameraUniforms],
            depthTest: true,
            depthWriteMask: true,
        });

        const { instances, geometries, materials } = this;
        const meshes: { readonly material: MaterialAsset; readonly geometry: GeometryAsset; readonly instance: InstanceAsset }[] = [];
        for (const obj of state.dynamic.objects) {
            const instance = instances.get(obj.instance)!;
            for (const primitive of obj.mesh.primitives) {
                const geometry = geometries.get(primitive.geometry)!;
                const material = materials.get(primitive.material)!;
                meshes.push({ material, geometry, instance });
            }
        }
        // sort by material and then instance
        meshes.sort((a, b) => {
            let diff = a.material.index - b.material.index;
            if (diff == 0) {
                diff = a.instance.index - b.instance.index;
            }
            return diff;
        })

        // vertex attribute defaults
        gl.vertexAttrib4f(3, 1, 1, 1, 1); // color0

        let currentMaterial: MaterialAsset = undefined!;
        let currentInstance: InstanceAsset = undefined!;
        for (const { material, instance, geometry } of meshes) {
            if (currentMaterial != material) {
                currentMaterial = material;
                gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, material.uniformsBuffer);
                glState(gl, currentMaterial.stateParams);
            }
            if (currentInstance != instance) {
                currentInstance = instance;
                gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, instance.uniformsBuffer);
            }
            gl.bindVertexArray(geometry.resources.vao);
            glDraw(gl, geometry.drawParams);
        }
    }

    contextLost(): void {
    }

    dispose() {
        const { context, programs, buffers, geometries, materials, instances } = this;
        const { gl } = context;
        this.contextLost();
        glDelete(gl, programs);
        const assets = [...buffers.values(), ...geometries.values(), ...materials.values(), ...instances.values()];
        for (const asset of assets) {
            asset.dispose(gl);
        }
        buffers.clear();
        geometries.clear();
        materials.clear();
        instances.clear();
    }
}

function syncAssets<TK, TV extends { index: number, dispose(gl: WebGL2RenderingContext): void }>(gl: WebGL2RenderingContext, uniqueResources: Iterable<TK>, map: Map<TK, TV>, create: (resource: TK, index: number) => TV) {
    // delete unreferenced resources
    const unreferenced = new Map<TK, TV>(map);
    for (const resource of uniqueResources) {
        unreferenced.delete(resource);
    }
    for (const [resource, asset] of unreferenced) {
        map.delete(resource);
        asset.dispose(gl);
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

    constructor(gl: WebGL2RenderingContext, kind: "ARRAY_BUFFER" | "ELEMENT_ARRAY_BUFFER", srcData: BufferSource) {
        this.buffer = glBuffer(gl, { kind, srcData });
    }

    dispose(gl: WebGL2RenderingContext) {
        gl.deleteBuffer(this.buffer);
    }
}

class GeometryAsset {
    index = 0;
    readonly drawParams: DrawParamsElements | DrawParamsArrays;
    readonly resources;

    constructor(gl: WebGL2RenderingContext, data: RenderStateDynamicGeometry, buffers: Map<BufferSource, BufferAsset>) {
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
        const params: VertexArrayParams = {
            attributes: [
                convAttr(position),
                convAttr(normal),
                convAttr(tangent),
                convAttr(color0),
                convAttr(texCoord0),
                convAttr(texCoord1),
            ],
            indices: typeof data.indices == "number" ? undefined : glBuffer(gl, { kind: "ELEMENT_ARRAY_BUFFER", srcData: data.indices }),
        }
        const vao = glVertexArray(gl, params);
        this.resources = { vao } as const;
    }

    dispose(gl: WebGL2RenderingContext) {
        glDelete(gl, this.resources);
    }
}

class InstanceAsset {
    index = 0;
    private readonly modelWorldMatrix;
    private readonly uniforms;
    readonly uniformsBuffer;

    constructor(context: RenderContext, data: RenderStateDynamicInstance, state: DerivedRenderState) {
        this.modelWorldMatrix = data.transform;
        const uniformsDesc = {
            modelLocalMatrix: "mat4",
            modelLocalMatrixNormal: "mat3",
            objectId: "uint",
        } as const satisfies Record<string, UniformTypes>;
        this.uniforms = createUniformsProxy(uniformsDesc);
        const { values } = this.uniforms;
        values.objectId = data.objectId ?? 0xffffffff;
        const { gl } = context;
        this.uniformsBuffer = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: this.uniforms.buffer });
        this.update(context, state);
    }

    update(context: RenderContext, state: DerivedRenderState) {
        const { uniforms, modelWorldMatrix, uniformsBuffer } = this;
        const { values } = uniforms;
        const worldLocalMatrix = mat4.fromTranslation(mat4.create(), state.localSpaceTranslation);
        const modelLocalMatrix = mat4.multiply(mat4.create(), worldLocalMatrix, modelWorldMatrix);
        values.modelLocalMatrix = modelLocalMatrix;
        values.modelLocalMatrixNormal = mat3.normalFromMat4(mat3.create(), modelLocalMatrix);
        context.updateUniformBuffer(uniformsBuffer, uniforms);
    }

    dispose(gl: WebGL2RenderingContext) {
        gl.deleteBuffer(this.uniformsBuffer);
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
        context: RenderContext,
        data: RenderStateDynamicMaterial,
        textures: Map<RenderStateDynamicImage, TextureAsset>,
        samplers: Map<RenderStateDynamicSampler, SamplerAsset>,
        defaultTexture: WebGLTexture,
        defaultSamper: WebGLSampler,
        program: DynamicModuleContext["programs"]["ggx"],
    ) {
        const { gl } = context;
        this.kind = data.kind;
        const blend = {
            blendEnable: true,
            blendSrcRGB: "SRC_ALPHA",
            blendDstRGB: "ONE_MINUS_SRC_ALPHA",
            blendSrcAlpha: "ZERO",
            blendDstAlpha: "ONE",
        } as const satisfies StateParams;
        this.stateParams = {
            program,
            cullEnable: data.doubleSided ? false : true,
            ...(data.alphaMode == "BLEND" ? blend : {}),
            drawBuffers: data.alphaMode == "BLEND" ? ["COLOR_ATTACHMENT0"] : ["COLOR_ATTACHMENT0", "COLOR_ATTACHMENT1", "COLOR_ATTACHMENT2", "COLOR_ATTACHMENT3"],
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
        const uniformsProxy = this.uniforms = createUniformsProxy(uniformsDesc);
        let tex = this.textures;
        let samp = this.samplers;
        const { values } = uniformsProxy;
        const { baseColorTexture } = data;
        values.baseColorFactor = data.baseColorFactor ?? [1, 1, 1, 1];
        values.baseColorUVSet = data.baseColorTexture ? data.baseColorTexture.texCoord ?? 0 : -1;
        values.alphaCutoff = data.alphaCutoff ?? data.alphaMode == "MASK" ? .5 : 0;
        values.radianceMipCount = context.iblTextures.numMipMaps;
        if (baseColorTexture) {
            tex.baseColor = textures.get(baseColorTexture.texture.image)!.texture;
            samp.baseColor = samplers.get(baseColorTexture.texture.sampler!)?.sampler ?? defaultSamper;
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
                samp.emissive = samplers.get(emissiveTexture.texture.sampler!)?.sampler ?? defaultSamper;
            }
            if (normalTexture) {
                tex.normal = textures.get(normalTexture.texture.image)!.texture;
                samp.normal = samplers.get(normalTexture.texture.sampler!)?.sampler ?? defaultSamper;
            }
            if (occlusionTexture) {
                tex.occlusion = textures.get(occlusionTexture.texture.image)!.texture;
                samp.occlusion = samplers.get(occlusionTexture.texture.sampler!)?.sampler ?? defaultSamper;
            }
            if (metallicRoughnessTexture) {
                tex.metallicRoughness = textures.get(metallicRoughnessTexture.texture.image)!.texture;
                samp.metallicRoughness = samplers.get(metallicRoughnessTexture.texture.sampler!)?.sampler ?? defaultSamper;
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
        this.uniformsBuffer = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
    }

    update(context: RenderContext, state: DerivedRenderState, defaultTexture: WebGLTexture, textureUniformLocations: DynamicModuleContext["textureUniformLocations"]["ggx"]) {
        const { iblTextures, lut_ggx, samplerSingle, samplerMip } = context;
        if (iblTextures) {
            const { uniforms, uniformsBuffer, textures, samplers } = this;
            const { diffuse, specular, numMipMaps } = iblTextures;
            type Mutable<T> = { -readonly [P in keyof T]: T[P] };
            const mutableState = this.stateParams as Mutable<StateParams>;
            mutableState.textures = [
                { kind: "TEXTURE_2D", texture: lut_ggx, sampler: samplerSingle, uniform: textureUniformLocations.ibl_lut_ggx },
                { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerSingle, uniform: textureUniformLocations.ibl_diffuse },
                { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip, uniform: textureUniformLocations.ibl_specular },
                { kind: "TEXTURE_2D", texture: textures.baseColor ?? defaultTexture, sampler: samplers.baseColor ?? null, uniform: textureUniformLocations.base_color },
                { kind: "TEXTURE_2D", texture: textures.metallicRoughness ?? defaultTexture, sampler: samplers.metallicRoughness ?? null, uniform: textureUniformLocations.metallic_roughness },
                { kind: "TEXTURE_2D", texture: textures.normal ?? defaultTexture, sampler: samplers.normal ?? null, uniform: textureUniformLocations.normal },
                { kind: "TEXTURE_2D", texture: textures.emissive ?? defaultTexture, sampler: samplers.emissive ?? null, uniform: textureUniformLocations.emissive },
                { kind: "TEXTURE_2D", texture: textures.occlusion ?? defaultTexture, sampler: samplers.occlusion ?? null, uniform: textureUniformLocations.occlusion },
            ] as const;
            uniforms.values.radianceMipCount = numMipMaps;
            context.updateUniformBuffer(uniformsBuffer, uniforms);
        }
    }

    dispose(gl: WebGL2RenderingContext) {
        gl.deleteBuffer(this.uniformsBuffer);
    }
}

class TextureAsset {
    index = 0;
    readonly texture: WebGLTexture;

    constructor(gl: WebGL2RenderingContext, image: RenderStateDynamicImage) {
        this.texture = glTexture(gl, image.params);
    }

    dispose(gl: WebGL2RenderingContext) {
        gl.deleteTexture(this.texture);
    }
}

class SamplerAsset {
    index = 0;
    readonly sampler: WebGLSampler;

    constructor(gl: WebGL2RenderingContext, sampler: RenderStateDynamicSampler) {
        this.sampler = glSampler(gl, sampler);
    }

    dispose(gl: WebGL2RenderingContext) {
        gl.deleteSampler(this.sampler);
    }
}