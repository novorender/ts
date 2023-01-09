import { ReadonlyMat3, ReadonlyMat4 } from "gl-matrix";
import { DrawMode, MagFilterString, MinFilterString, RGBA, TextureParams2DUncompressed, VertexAttribute, WrapString } from "webgl2";
import { RGB } from "./types";

export interface RenderStateDynamicImage {
    readonly params: TextureParams2DUncompressed; // TODO: Add support for compressed textures
}

export interface RenderStateDynamicSampler {
    readonly minificationFilter?: MinFilterString;
    readonly magnificationFilter?: MagFilterString;
    readonly wrap?: readonly [WrapString, WrapString];
}

export interface RenderStateDynamicTexture {
    readonly image: RenderStateDynamicImage;
    readonly sampler?: RenderStateDynamicSampler;
}

export interface RenderStateDynamicTextureReference {
    readonly texture: RenderStateDynamicTexture;
    readonly texCoord?: 0 | 1; // default: 0
    readonly transform?: ReadonlyMat3; // default: identity matrix
}

export interface RenderStateDynamicNormalTextureReference extends RenderStateDynamicTextureReference {
    readonly scale?: number; // default: 1
}

export interface RenderStateDynamicOcclusionTextureReference extends RenderStateDynamicTextureReference {
    readonly strength?: number; // default: 1
}

export type RenderStateDynamicVertexAttribute = Omit<VertexAttribute, "buffer"> & { readonly buffer: BufferSource };

export interface RenderStateDynamicVertexAttributes {
    readonly position: RenderStateDynamicVertexAttribute;
    readonly normal?: RenderStateDynamicVertexAttribute;
    readonly tangent?: RenderStateDynamicVertexAttribute;
    readonly color0?: RenderStateDynamicVertexAttribute;
    readonly texCoord0?: RenderStateDynamicVertexAttribute;
    readonly texCoord1?: RenderStateDynamicVertexAttribute;
}

export interface RenderStateDynamicGeometry {
    readonly primitiveType: DrawMode;
    readonly attributes: RenderStateDynamicVertexAttributes;
    readonly indices: Uint32Array | Uint16Array | Uint8Array | number;
}

export interface RenderStateDynamicMeshPrimitive {
    readonly geometry: RenderStateDynamicGeometry;
    readonly material: RenderStateDynamicMaterial;
}

export interface RenderStateDynamicMesh {
    readonly primitives: readonly RenderStateDynamicMeshPrimitive[];
}

interface RenderStateDynamicMaterialCommon {
    readonly doubleSided?: boolean; // default: false
    readonly alphaMode?: "OPAQUE" | "MASK" | "BLEND"; // default: "OPAQUE"
    readonly alphaCutoff?: number; // default 0.5
}


export interface RenderStateDynamicMaterialUnlit extends RenderStateDynamicMaterialCommon {
    readonly kind: "unlit";
    readonly baseColorFactor?: RGBA; // default: [1,1,1,1]
    readonly baseColorTexture?: RenderStateDynamicTextureReference;
}

export interface RenderStateDynamicMaterialGGX extends RenderStateDynamicMaterialCommon {
    readonly kind: "ggx";
    readonly baseColorFactor?: RGBA; // default [1,1,1,1]
    readonly metallicFactor?: number; // default: 1
    readonly roughnessFactor?: number; // default: 1
    readonly emissiveFactor?: RGB; // default [0,0,0]
    readonly baseColorTexture?: RenderStateDynamicTextureReference;
    readonly metallicRoughnessTexture?: RenderStateDynamicTextureReference;
    readonly normalTexture?: RenderStateDynamicNormalTextureReference;
    readonly occlusionTexture?: RenderStateDynamicOcclusionTextureReference;
    readonly emissiveTexture?: RenderStateDynamicTextureReference;
    // TODO: include specular, ior and clearcoat?
}

export type RenderStateDynamicMaterial = RenderStateDynamicMaterialUnlit | RenderStateDynamicMaterialGGX;

export interface RenderStateDynamicInstance {
    // parent/children?
    readonly transform: ReadonlyMat4;
    readonly objectId?: number;
}

export interface RenderStateDynamicObject {
    readonly mesh: RenderStateDynamicMesh;
    readonly instance: RenderStateDynamicInstance;
}

export interface RenderStateDynamicObjects {
    readonly objects: readonly RenderStateDynamicObject[];
}
