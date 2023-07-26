import type { ReadonlyMat3, ReadonlyMat4, ReadonlyQuat, ReadonlyVec3 } from "gl-matrix";
import type { DrawMode, MagFilterString, MinFilterString, RGBA, TextureParams2DUncompressed, VertexAttribute, WrapString } from "webgl2";
import type { RGB } from "./types";

/** Texture image related state. */
export interface RenderStateDynamicImage {
    /** The parameters for to 2D, uncompressed texture creation. */
    readonly params: TextureParams2DUncompressed; // TODO: Add support for compressed textures
}

/** Texture sampled related state
 * @see 
 * https://en.wikipedia.org/wiki/Texture_filtering
 * https://learnopengl.com/Getting-started/Textures
 */
export interface RenderStateDynamicSampler {
    /** Minification filter
     * @default `"NEAREST_MIPMAP_LINEAR"`
     */
    readonly minificationFilter?: MinFilterString;

    /** Magnification filter
     * @default `"LINEAR"`
     */
    readonly magnificationFilter?: MagFilterString;

    /** Tuple of S and T wrap mode, respectively.
     * @default `["REPEAT", "REPEAT"]`
     */
    readonly wrap?: readonly [WrapString, WrapString];
}

/** Texture related state. */
export interface RenderStateDynamicTexture {
    /** Image to use for this texture */
    readonly image: RenderStateDynamicImage;

    /** Sampler to use for this texture
     * @default Sampler with all default values.
     */
    readonly sampler?: RenderStateDynamicSampler;
}

/** Texture reference state. */
export interface RenderStateDynamicTextureReference {
    /** What texture to use. */
    readonly texture: RenderStateDynamicTexture;

    /** What set of texture coordinates to use (0 or 1).
     * @default 0
     */
    readonly texCoord?: 0 | 1;

    /** Optional texture coordinate 3x3 transformation matrix
     * @default Identity matrix.
     */
    readonly transform?: ReadonlyMat3;
}

/** Normal map texture reference state. */
export interface RenderStateDynamicNormalTextureReference extends RenderStateDynamicTextureReference {
    /** Scale factor to apply to normal XY coordinate.
     * @default 1.0
     */
    readonly scale?: number;
}

/** Occlusion map texture reference state. */
export interface RenderStateDynamicOcclusionTextureReference extends RenderStateDynamicTextureReference {
    /** Strength factor to apply to occlusion [0.0, 1.0].
     * @default 1.0
     */
    readonly strength?: number;
}

/** Vertex attribute type for dynamic objects. */
export type RenderStateDynamicVertexAttribute = Omit<VertexAttribute, "buffer"> & { readonly buffer: BufferSource };

/** Dynamic mesh vertex attributes state. */
export interface RenderStateDynamicVertexAttributes {
    /** Vertex position. */
    readonly position: RenderStateDynamicVertexAttribute;

    /** Vertex normal. */
    readonly normal?: RenderStateDynamicVertexAttribute;

    /** Vertex tangent.
     * @remarks Bi-tangent is computed from normal and tangent, if needed.
     */
    readonly tangent?: RenderStateDynamicVertexAttribute;

    /** Vertex color. */
    readonly color0?: RenderStateDynamicVertexAttribute;

    /** Vertex texture coordinate, set 0. */
    readonly texCoord0?: RenderStateDynamicVertexAttribute;

    /** Vertex texture coordinate, set 1. */
    readonly texCoord1?: RenderStateDynamicVertexAttribute;
}

/** Dynamic mesh geometry state. */
export interface RenderStateDynamicGeometry {
    /** Type of render primitive. */
    readonly primitiveType: DrawMode;
    /** Vertex attributes. */
    readonly attributes: RenderStateDynamicVertexAttributes;
    /** Array of Vertex indices, or # vertices if mesh is not indexed. */
    readonly indices: Uint32Array | Uint16Array | Uint8Array | number;
}

/** Dynamic mesh primitive.
 * @remarks
 * Meshes are rendered one material at a time.
 * This interfaces describes such a sub-mesh, or mesh primitive
 */
export interface RenderStateDynamicMeshPrimitive {
    /** What dynamic mesh geometry to use. */
    readonly geometry: RenderStateDynamicGeometry;

    /** What dynamic mesh material to use. */
    readonly material: RenderStateDynamicMaterial;
}

/** Dynamic mesh render state. */
export interface RenderStateDynamicMesh {
    /** Array of geometry+material sub meshes. */
    readonly primitives: readonly RenderStateDynamicMeshPrimitive[];
}

/** Common material properties. */
interface RenderStateDynamicMaterialCommon {
    /** Whether to render material as double sided or not.
     * @default: false
     */
    readonly doubleSided?: boolean;

    /** How to interpret color alpha channel.
     * @remarks
     * `"OPAQUE"` renders all pixels regardless of alpha value.
     * 
     * `"MASK"` renders only pixels with alpha larger or equal to {@link alphaCutoff}.
     * 
     * `"BLEND"` blends pixels with background using alpha as blending factor.
     */
    readonly alphaMode?: "OPAQUE" | "MASK" | "BLEND"; // default: "OPAQUE"

    /** Cutoff factor used for alpha masking.
     * @default 0.5
     */
    readonly alphaCutoff?: number;
}


/** Unlit material properties. */
export interface RenderStateDynamicMaterialUnlit extends RenderStateDynamicMaterialCommon {
    /** Material union discriminant. */
    readonly kind: "unlit";

    /** Factor used directly or multiplied with {@link baseColorTexture}, if defined, for material base color.
     * @default `[1,1,1,1]`
     */
    readonly baseColorFactor?: RGBA;

    /** Base color texture. */
    readonly baseColorTexture?: RenderStateDynamicTextureReference;
}

/** GGX type of PBR material.
 * @see https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#materials
 */
export interface RenderStateDynamicMaterialGGX extends RenderStateDynamicMaterialCommon {
    /** Material union discriminant. */
    readonly kind: "ggx";

    /** Factor used directly or multiplied with {@link baseColorTexture}, if defined, for material base color.
     * @default `[1,1,1,1]`
     */
    readonly baseColorFactor?: RGBA; // default [1,1,1,1]

    /** Metallicness PBR factor (0-1)
     * @default 1
     */
    readonly metallicFactor?: number; // default: 1

    /** Roughness PBR factor (0-1)
     * @default 1
     */
    readonly roughnessFactor?: number;

    /** Emissive light factor (0-1)
     * @default 1
     */
    readonly emissiveFactor?: RGB; // default [0,0,0]

    /** Base color texture. */
    readonly baseColorTexture?: RenderStateDynamicTextureReference;

    /** PBR Mmtallic + roughness texture.
     * @see https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#metallic-roughness-material
     */
    readonly metallicRoughnessTexture?: RenderStateDynamicTextureReference;

    /** PBR surface normal texture  */
    readonly normalTexture?: RenderStateDynamicNormalTextureReference;

    /** Occlusion/AO texture  */
    readonly occlusionTexture?: RenderStateDynamicOcclusionTextureReference;

    /** Emissive light texture */
    readonly emissiveTexture?: RenderStateDynamicTextureReference;

    // TODO: include specular, ior and clearcoat?
}

/** Material related render state. */
export type RenderStateDynamicMaterial = RenderStateDynamicMaterialUnlit | RenderStateDynamicMaterialGGX;

/** Dynamic object instance render state. */
export interface RenderStateDynamicInstance {
    /** Object instance position, in world space. */
    readonly position: ReadonlyVec3;

    /** Object instance rotation, in world space. */
    readonly rotation?: ReadonlyQuat;
}

/** Dynamic object related render state. */
export interface RenderStateDynamicObject {
    /** What mesh to render. */
    readonly mesh: RenderStateDynamicMesh;

    /**
     * Object instances
     * @remarks
     * Instances renders the same mesh once for reach instance at a unique position and rotation.
     * This is accomplished by using GPU instancing,
     * which means there is very little overhead per instance.
     * As long as the total triangle count remains tolerable, thousands of instances is no problem.
     * @see https://learnopengl.com/Advanced-OpenGL/Instancing
     */
    readonly instances: readonly RenderStateDynamicInstance[];

    /** What base object id/index to use for object instances.*/
    readonly baseObjectId?: number;
}

/**
 * Dynamic object related render state
 * @remarks
 * Unlike static/streamable geometry, dynamic objects can be moved and rotated freely.
 * They do not support level of detail (LOD), however, so care must be taken not to use excessive amount of triangles/primitives.
 * Also, geometry is kept both in javascript memory in the form of render state,
 * and also in GPU/WebGL2 memory as renderable geometry,
 * so avoid complex, memory consuming models if possible.
 * Dynamic objects can be created procedurally or by loading a glTF2 file {@link loadGLTF}.
 * 
 * Since there is a significant overlap between the {@link https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html | gltf2 specifications} and this render state,
 * you may read the glTF2 specs to learn more details.
 */
export interface RenderStateDynamicObjects {
    /** Dynamic objects to render. */
    readonly objects: readonly RenderStateDynamicObject[];
}
