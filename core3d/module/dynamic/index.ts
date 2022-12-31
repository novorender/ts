import { DerivedRenderState, RenderContext, RenderStateDynamicGeometry, RenderStateDynamicInstance, RenderStateDynamicMaterial, RenderStateDynamicMesh, RenderStateDynamicMeshPrimitive, RenderStateDynamicObject, RenderStateDynamicVertexAttribute } from "core3d";
import { CoordSpace } from "core3d";
import { RenderModuleContext, RenderModule } from "..";
import { createUniformsProxy, glBuffer, glProgram, glDraw, glState, glDelete, UniformTypes, glVertexArray, VertexArrayParams, VertexAttribute, DrawParamsElements, DrawParamsArrays, StateParams, glUniformLocations } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat4, vec3 } from "gl-matrix";

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
    iblTextures: RenderContext["iblTextures"];
    readonly programs;
    readonly textureUniformLocations;
    readonly buffers = new Map<BufferSource, BufferAsset>();
    readonly geometries = new Map<RenderStateDynamicGeometry, GeometryAsset>();
    readonly instances = new Map<RenderStateDynamicInstance, InstanceAsset>();
    readonly materials = new Map<RenderStateDynamicMaterial, MaterialAsset>();

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
    }

    update(state: DerivedRenderState) {
        const { context, programs, textureUniformLocations } = this;
        const { gl } = context;
        const { dynamic, localSpaceTranslation } = state;
        if (context.hasStateChanged({ dynamic })) {
            // synchronizing assets by reference is slower than array indexing, but it makes the render state safer and simpler to modify.
            // performance should not be a major issue for < 1000 objects or so
            const primitives = [...new Set<RenderStateDynamicMeshPrimitive>(dynamic.objects.flatMap(o => o.mesh.primitives))];
            const geometries = [...new Set<RenderStateDynamicGeometry>(primitives.map(p => p.geometry))];
            const materials = [...new Set<RenderStateDynamicMaterial>(primitives.map(p => p.material))];
            const instances = [...new Set<RenderStateDynamicInstance>(dynamic.objects.map(o => o.instance))];
            const vertexBuffers = new Set<BufferSource>(geometries.flatMap(g => [...Object.values(g.attributes).map((a: RenderStateDynamicVertexAttribute) => a.buffer).filter(b => b)]));
            const indexBuffers = new Set<BufferSource>(geometries.map(g => typeof g.indices == "number" ? undefined : g.indices).filter(b => b) as BufferSource[]);
            const numVertexBuffers = vertexBuffers.size;
            const buffers = [...vertexBuffers, ...indexBuffers];
            syncAssets(gl, buffers, this.buffers, (data, idx) => new BufferAsset(gl, idx < numVertexBuffers ? "ARRAY_BUFFER" : "ELEMENT_ARRAY_BUFFER", data));
            syncAssets(gl, geometries, this.geometries, data => new GeometryAsset(gl, data, this.buffers));
            syncAssets(gl, instances, this.instances, data => new InstanceAsset(context, data, state));
            syncAssets(gl, materials, this.materials, data => new MaterialAsset(context, data, programs[data.kind]));
        }
        if (context.hasStateChanged({ localSpaceTranslation })) {
            for (const instance of this.instances.values()) {
                instance.update(context, state);
            }
        }
        if (context.iblTextures != this.iblTextures) {
            this.iblTextures = context.iblTextures;
            for (const material of this.materials.values()) {
                material.update(context, state, textureUniformLocations[material.kind]);
            }
        }
    }

    render(state: DerivedRenderState) {
        const { context } = this;
        const { gl, cameraUniforms } = context;
        if (!context.iblTextures) {
            return;
        }

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
                gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, material.resources.uniforms);
                glState(gl, currentMaterial.stateParams);
            }
            if (currentInstance != instance) {
                currentInstance = instance;
                gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, instance.resources.uniforms);
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
    readonly resources;

    constructor(context: RenderContext, data: RenderStateDynamicInstance, state: DerivedRenderState) {
        this.modelWorldMatrix = data.transform;
        const uniformsDesc = {
            modelLocalMatrix: "mat4",
            objectId: "uint",
        } as const satisfies Record<string, UniformTypes>;
        this.uniforms = createUniformsProxy(uniformsDesc);
        const { values } = this.uniforms;
        values.objectId = data.objectId ?? 0xffffffff;
        const { gl } = context;
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: this.uniforms.buffer });
        this.resources = { uniforms } as const;
        this.update(context, state);
    }

    update(context: RenderContext, state: DerivedRenderState) {
        const { uniforms, modelWorldMatrix, resources } = this;
        const { values } = uniforms;
        const worldLocalMatrix = mat4.fromTranslation(mat4.create(), state.localSpaceTranslation);
        values.modelLocalMatrix = mat4.multiply(mat4.create(), worldLocalMatrix, modelWorldMatrix);
        context.updateUniformBuffer(resources.uniforms, uniforms);
    }

    dispose(gl: WebGL2RenderingContext) {
        glDelete(gl, this.resources);
    }
}

class MaterialAsset {
    index = 0;
    readonly kind;
    readonly uniforms;
    readonly stateParams: StateParams;
    readonly resources;

    constructor(
        context: RenderContext,
        data: RenderStateDynamicMaterial,
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
        const { values } = uniformsProxy;
        values.baseColorFactor = data.baseColorFactor ?? [1, 1, 1, 1];
        values.baseColorUVSet = data.baseColorTexture ? data.baseColorTexture.texCoord ?? 0 : -1;
        values.alphaCutoff = data.alphaCutoff ?? data.alphaMode == "MASK" ? .5 : 0;
        values.radianceMipCount = context.iblTextures?.numMipMaps ?? 0;
        if (data.kind == "ggx") {
            values.roughnessFactor = data.roughnessFactor ?? 1;
            values.metallicFactor = data.metallicFactor ?? 1;
            values.emissiveFactor = data.emissiveFactor ?? [0, 0, 0];
            values.metallicRoughnessUVSet = data.metallicRoughnessTexture ? data.metallicRoughnessTexture.texCoord ?? 0 : -1;
            values.normalUVSet = data.normalTexture ? data.normalTexture.texCoord ?? 0 : -1;
            values.normalScale = data.normalTexture?.scale ?? 0;
            values.occlusionUVSet = data.occlusionTexture ? data.occlusionTexture.texCoord ?? 0 : -1;
            values.occlusionStrength = data.occlusionTexture?.strength ?? 0;
            values.emissiveUVSet = data.emissiveTexture ? data.emissiveTexture.texCoord ?? 0 : -1;
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
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
        this.resources = { uniforms } as const;
    }

    update(context: RenderContext, state: DerivedRenderState, textureUniformLocations: DynamicModuleContext["textureUniformLocations"]["ggx"]) {
        const { iblTextures } = context;
        if (iblTextures) {
            const { uniforms, resources } = this;
            const { samplerSingle, samplerMip, diffuse, specular, lut_ggx, numMipMaps } = iblTextures;
            type Mutable<T> = { -readonly [P in keyof T]: T[P] };
            const mutableState = this.stateParams as Mutable<StateParams>;
            mutableState.textures = [
                { kind: "TEXTURE_2D", texture: lut_ggx, sampler: samplerSingle, uniform: textureUniformLocations.ibl_lut_ggx },
                { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerSingle, uniform: textureUniformLocations.ibl_diffuse },
                { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip, uniform: textureUniformLocations.ibl_specular },
                // TODO: Add rest of textures
            ] as const;
            uniforms.values.radianceMipCount = numMipMaps;
            context.updateUniformBuffer(resources.uniforms, uniforms);
        }
    }

    dispose(gl: WebGL2RenderingContext) {
        glDelete(gl, this.resources);
    }
}