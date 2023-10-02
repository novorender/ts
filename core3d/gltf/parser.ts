import { vec3, mat4, quat, type ReadonlyMat4, mat3, type ReadonlyVec3, glMatrix } from "gl-matrix";
import type { MagFilterString, MinFilterString, TextureParams2DUncompressed, WrapString } from "webgl2";
import { GL } from "webgl2/constants";
import type { RenderStateDynamicGeometry, RenderStateDynamicImage, RenderStateDynamicInstance, RenderStateDynamicMaterialGGX, RenderStateDynamicMaterialUnlit, RenderStateDynamicMesh, RenderStateDynamicMeshPrimitive, RenderStateDynamicNormalTextureReference, RenderStateDynamicObject, RenderStateDynamicOcclusionTextureReference, RenderStateDynamicSampler, RenderStateDynamicTexture, RenderStateDynamicTextureReference, RenderStateDynamicVertexAttribute, RenderStateDynamicVertexAttributes, RGB, RGBA } from "../state";
import * as GLTF from "./types";


function decomposeMatrix(transform: mat4) {
    const [sx, sy, sz] = mat4.getScaling(vec3.create(), transform);
    let scale: number | undefined = (sx + sy + sz) / 3; // get average scale factor.
    const epsilon = 1E-5;
    if (scale > 1 - epsilon && scale < 1 + epsilon) {
        scale = undefined;
    }
    const rotation = quat.fromMat3(quat.create(), mat3.fromMat4(mat3.create(), transform));
    const position = vec3.fromValues(transform[12], transform[13], transform[14]);
    return { rotation, position, scale } as const;
}


function getTransform(node: GLTF.Node) {
    const { matrix, translation, rotation, scale } = node;
    const transform: mat4 = mat4.create();
    if (matrix) {
        mat4.set(transform, ...(matrix as Parameters<typeof mat4.fromValues>));
    } else if (translation || rotation) {
        const t = translation ? vec3.fromValues(...(translation as Parameters<typeof vec3.fromValues>)) : vec3.create();
        const r = rotation ? quat.fromValues(...(rotation as Parameters<typeof quat.fromValues>)) : quat.create();
        const s = scale ? vec3.fromValues(...(rotation as Parameters<typeof vec3.fromValues>)) : vec3.fromValues(1, 1, 1);
        mat4.fromRotationTranslationScale(transform, r, t, s);
    }
    return transform;
}

/** @internal */
export async function parseGLTF(buffers: ArrayBuffer[], gltf: GLTF.GlTf, externalImageBlobs: (Blob | undefined)[], baseObjectId?: number): Promise<readonly RenderStateDynamicObject[]> {
    const { extensionsRequired, extensionsUsed } = gltf;
    if (extensionsUsed && extensionsUsed.length != 0 && extensionsUsed[0] != "KHR_materials_unlit") {
        console.warn(`The following glTF extensions were used, but are not supported: ${extensionsUsed.join(', ')}!`);
    }
    if (extensionsRequired && extensionsRequired.length != 0 && extensionsRequired[0] != "KHR_materials_unlit") {
        throw new Error(`The following glTF extensions were required, but are not supported: ${extensionsRequired.join(', ')}!`);
    }
    const filters = {
        [GL.NEAREST]: "NEAREST",
        [GL.LINEAR]: "LINEAR",
        [GL.NEAREST_MIPMAP_NEAREST]: "NEAREST_MIPMAP_NEAREST",
        [GL.LINEAR_MIPMAP_NEAREST]: "LINEAR_MIPMAP_NEAREST",
        [GL.NEAREST_MIPMAP_LINEAR]: "NEAREST_MIPMAP_LINEAR",
        [GL.LINEAR_MIPMAP_LINEAR]: "LINEAR_MIPMAP_LINEAR",
    } as { [index: number]: string };

    const wrappings = {
        [GL.CLAMP_TO_EDGE]: "CLAMP_TO_EDGE",
        [GL.MIRRORED_REPEAT]: "MIRRORED_REPEAT",
        [GL.REPEAT]: "REPEAT",
    } as { [index: number]: string };

    const attributeNames = {
        POSITION: "position",
        NORMAL: "normal",
        TANGENT: "tangent",
        TEXCOORD_0: "texCoord0",
        TEXCOORD_1: "texCoord1",
        COLOR_0: "color0",
    } as const;

    const attributeCompontentTypes = {
        [GL.FLOAT]: "FLOAT",
        [GL.BYTE]: "BYTE",
        [GL.SHORT]: "SHORT",
        [GL.INT]: "INT",
        [GL.UNSIGNED_BYTE]: "UNSIGNED_BYTE",
        [GL.UNSIGNED_SHORT]: "UNSIGNED_SHORT",
        [GL.UNSIGNED_INT]: "UNSIGNED_INT",
    } as const;

    /** Spec: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#accessor-element-size */
    const attributeComponentCounts = {
        SCALAR: 1,
        VEC2: 2,
        VEC3: 3,
        VEC4: 4,
    } as const;

    const attributeCompontentTypePrefixes = {
        [GL.FLOAT]: "FLOAT",
        [GL.BYTE]: "INT",
        [GL.SHORT]: "INT",
        [GL.INT]: "INT",
        [GL.UNSIGNED_BYTE]: "UNSIGNED_INT",
        [GL.UNSIGNED_SHORT]: "UNSIGNED_INT",
        [GL.UNSIGNED_INT]: "UNSIGNED_INT",
    } as const;

    const topologies = {
        [GL.POINTS]: "POINTS",
        [GL.LINES]: "LINES",
        [GL.LINE_LOOP]: "LINE_LOOP",
        [GL.LINE_STRIP]: "LINE_STRIP",
        [GL.TRIANGLES]: "TRIANGLES",
        [GL.TRIANGLE_STRIP]: "TRIANGLE_STRIP",
        [GL.TRIANGLE_FAN]: "TRIANGLE_FAN",
    } as const;

    /** Spec: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#accessor-element-size */
    const bufferTypes = {
        [GL.UNSIGNED_BYTE]: Uint8Array,
        [GL.UNSIGNED_SHORT]: Uint16Array,
        [GL.UNSIGNED_INT]: Uint32Array,
        [GL.BYTE]: Int8Array,
        [GL.SHORT]: Int16Array,
        [GL.INT]: Int32Array,
        [GL.FLOAT]: Float32Array,
    } as const;

    const bufferViews = gltf.bufferViews!.map(v => {
        return new Uint8Array(buffers[v.buffer], v.byteOffset, v.byteLength);
    });

    function getImageBlob(image: GLTF.Image) {
        const bufferView = gltf.bufferViews![image.bufferView!];
        const begin = bufferView.byteOffset ?? 0;
        const end = bufferView.byteLength ? begin + bufferView.byteLength : undefined;
        const buffer = buffers[bufferView.buffer].slice(begin, end);
        return new Blob([buffer]);
    }

    const imagePromises = gltf.images?.map(async (img, idx) => {
        // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#images
        let blob = externalImageBlobs[idx] ?? getImageBlob(img);
        if (img.mimeType) {
            blob = new Blob([blob], { type: img.mimeType });
        }
        const image = await createImageBitmap(blob, { colorSpaceConversion: "none" });
        const { width, height } = image;
        const params: TextureParams2DUncompressed = { kind: "TEXTURE_2D", width, height, generateMipMaps: true, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image };
        return { params } as RenderStateDynamicImage;
    }) ?? [];
    const images = await Promise.all(imagePromises);

    const samplers = gltf.samplers?.map(s => {
        // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#samplers
        const { magFilter, minFilter, wrapS, wrapT } = s;
        const minificationFilter = filters[minFilter ?? GL.LINEAR_MIPMAP_LINEAR] as MinFilterString;
        const magnificationFilter = filters[magFilter ?? GL.LINEAR] as MagFilterString;
        const wrap = wrapS && wrapT ? [wrappings[wrapS] as WrapString, wrappings[wrapT] as WrapString] as const : ["REPEAT", "REPEAT"] as const;
        return { minificationFilter, magnificationFilter, wrap } as RenderStateDynamicSampler;
    }) ?? [];

    const textures = gltf.textures?.map(t => {
        // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
        const image = images[t.source!];
        const sampler = samplers[t.sampler!];
        return { image, sampler } as RenderStateDynamicTexture;
    }) ?? [];

    const defaultGGXMaterial: RenderStateDynamicMaterialGGX = { kind: "ggx" };
    const defaultUnlitMaterial: RenderStateDynamicMaterialUnlit = { kind: "unlit" };
    const materials = gltf.materials?.map((m, i) => {
        const isUnlit = m.extensions && "KHR_materials_unlit" in m.extensions;
        const { pbrMetallicRoughness, normalTexture, occlusionTexture, emissiveTexture, emissiveFactor, alphaMode, alphaCutoff, doubleSided } = m;
        function getTexInfo(texInfo?: GLTF.TextureInfo | GLTF.MaterialNormalTextureInfo | GLTF.MaterialOcclusionTextureInfo) {
            if (texInfo) {
                const transform = undefined; // TODO: add KHR_texture_transform
                if ("scale" in texInfo) {
                    return {
                        texture: textures[texInfo.index] ?? null,
                        texCoord: texInfo.texCoord,
                        scale: texInfo.scale,
                        transform,
                    } as RenderStateDynamicNormalTextureReference;
                } else if ("strength" in texInfo) {
                    return {
                        texture: textures[texInfo.index] ?? null,
                        texCoord: texInfo.texCoord,
                        strength: texInfo.strength,
                        transform,
                    } as RenderStateDynamicOcclusionTextureReference;
                }
                return {
                    texture: textures[texInfo.index] ?? null,
                    texCoord: texInfo.texCoord,
                    transform,
                } as RenderStateDynamicTextureReference;
            }
        }
        if (isUnlit) {
            return {
                kind: "unlit",
                doubleSided: doubleSided,
                alphaMode: alphaMode as "OPAQUE" | "MASK" | "BLEND" | undefined,
                alphaCutoff: alphaCutoff,
                baseColorFactor: pbrMetallicRoughness?.baseColorFactor as RGBA | undefined,
                baseColorTexture: getTexInfo(pbrMetallicRoughness?.baseColorTexture),
            } as RenderStateDynamicMaterialUnlit;
        } else {
            return {
                kind: "ggx",
                doubleSided: doubleSided,
                alphaMode: alphaMode as "OPAQUE" | "MASK" | "BLEND" | undefined,
                alphaCutoff: alphaCutoff,
                baseColorFactor: pbrMetallicRoughness?.baseColorFactor as RGBA | undefined,
                metallicFactor: pbrMetallicRoughness?.metallicFactor,
                roughnessFactor: pbrMetallicRoughness?.roughnessFactor,
                emissiveFactor: emissiveFactor as RGB | undefined,
                baseColorTexture: getTexInfo(pbrMetallicRoughness?.baseColorTexture),
                metallicRoughnessTexture: getTexInfo(pbrMetallicRoughness?.metallicRoughnessTexture),
                normalTexture: getTexInfo(normalTexture),
                occlusionTexture: getTexInfo(occlusionTexture),
                emissiveTexture: getTexInfo(emissiveTexture),
            } as RenderStateDynamicMaterialGGX;
        }
    }) ?? [];

    const meshes = gltf.meshes?.map(m => {
        const primitives = m.primitives.map(p => {
            const attributes = {} as RenderStateDynamicVertexAttributes;
            for (const [key, value] of Object.entries(p.attributes)) {
                const name = attributeNames[key as keyof typeof attributeNames];
                // if (name != "position")
                //     continue;
                const accessor = gltf.accessors![value];
                console.assert(!accessor.sparse);
                const bufferView = gltf.bufferViews![accessor.bufferView!];
                const buffer = bufferViews[accessor.bufferView!];
                const componentType = accessor.componentType as keyof typeof attributeCompontentTypes;
                const prefix = attributeCompontentTypePrefixes[componentType];
                const type = accessor.type as "SCALAR" | "VEC2" | "VEC3" | "VEC4";
                const kind = accessor.type == "SCALAR" ? prefix : `${prefix}_${type as Exclude<typeof type, "SCALAR">}` as const;
                // const floatView = new Float32Array(buffer.buffer, buffer.byteOffset + (accessor.byteOffset ?? 0), accessor.count);
                const attrib = {
                    kind,
                    buffer,
                    componentType: attributeCompontentTypes[componentType],
                    componentCount: attributeComponentCounts[type],
                    normalized: accessor.normalized ?? false,
                    byteStride: bufferView.byteStride ?? 0,
                    byteOffset: accessor.byteOffset ?? 0,
                } as const satisfies RenderStateDynamicVertexAttribute;
                Reflect.set(attributes, name, attrib);
            };

            const indicesAccessor = p.indices != undefined ? gltf.accessors![p.indices] : undefined;
            const count = indicesAccessor ? indicesAccessor.count : gltf.accessors![p.attributes["POSITION"]!].count;
            const ib = bufferViews[indicesAccessor?.bufferView ?? -1];
            const IndexBufferType = indicesAccessor ? bufferTypes[indicesAccessor.componentType as GL.UNSIGNED_BYTE | GL.UNSIGNED_SHORT | GL.UNSIGNED_INT] : undefined;
            const indices = IndexBufferType ? new IndexBufferType(ib.buffer, ib.byteOffset + (indicesAccessor!.byteOffset ?? 0), indicesAccessor!.count) : count;
            const mode = topologies[p.mode as keyof typeof topologies] ?? "TRIANGLES";

            const geometry: RenderStateDynamicGeometry = {
                primitiveType: mode,
                attributes,
                indices,
            };
            const defaultMaterial = ((p.mode ?? 4) < 4) ? defaultUnlitMaterial : defaultGGXMaterial;
            const material = materials[p.material ?? -1] ?? defaultMaterial;
            return { geometry, material } as RenderStateDynamicMeshPrimitive;
        });
        return { primitives } as RenderStateDynamicMesh;
    }) ?? [];

    const objects: RenderStateDynamicObject[] = [];
    if (gltf.scenes && gltf.nodes) {
        const rootNodes = gltf.scenes[gltf.scene ?? 0].nodes;
        if (rootNodes) {
            function traverseNodeTree(nodeIndex: number, parentTransform?: ReadonlyMat4) {
                const node = gltf.nodes![nodeIndex];
                const transform = getTransform(node);
                if (parentTransform) {
                    mat4.multiply(transform, parentTransform, transform);
                }
                if (node.mesh != undefined) {
                    mat4.rotateX(transform, transform, glMatrix.toRadian(90)); // transform into CAD space.
                    const instance: RenderStateDynamicInstance = decomposeMatrix(transform);
                    const mesh = meshes[node.mesh];
                    const obj: RenderStateDynamicObject = { instances: [instance], mesh, baseObjectId };
                    objects.push(obj);
                }
                if (node.children) {
                    for (const child of node.children) {
                        traverseNodeTree(child, transform);
                    }
                }
            }
            for (const rootNodeIndex of rootNodes) {
                traverseNodeTree(rootNodeIndex);
            }
        }
    }
    return objects;
}
