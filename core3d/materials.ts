import type { Pow2, RGBA } from "webgl2";

export interface PBRMaterialTextures {
    /** Base color texture mip-map pixels. */
    readonly albedoTexture: readonly BufferSource[];

    /** Normal texture mip-map pixels. */
    readonly normalTexture: readonly BufferSource[];

    /** Occlusion/metallic/roughness texture mip-map pixels. */
    readonly occlusionMetallicRoughnessTexture: readonly BufferSource[];
}

export interface PBRMaterialCommon {
    /** # texture mip-maps. */
    readonly mipCount: number;

    /** Texture width, power of two, in pixels. */
    readonly width: Pow2;

    /** Texture height, power of two, in pixels. */
    readonly height: Pow2;
}

/** PBR material info. */
export interface PBRMaterialInfo {
    /** Material name/id. */
    readonly name: string;

    /** Linear scale, i.e. size per "tile" in meters. */
    readonly scale: number;

    /** Default base color factor. */
    readonly albedo: RGBA;

    /** Default metalness factor, i.e. 0 = plastic, 1 = metal. */
    readonly metalness: number;

    /** Default roughness factor, i.e. 0 = shiny, 1 = rough. */
    readonly roughness: number;
};


/** PBR material/texture data. */
export interface PBRMaterialData extends PBRMaterialInfo, PBRMaterialTextures, PBRMaterialCommon { };
