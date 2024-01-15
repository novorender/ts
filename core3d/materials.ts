import type { TextureParams2DUncompressedMipMapped, RGBA } from "webgl2";

/** PBR material/texture data. */
export interface PBRMaterialData {
    /** Linear scale, i.e. size per "tile" in meters. */
    readonly scale: number;

    /** Default base color. */
    readonly baseColorFactor: RGBA;

    /** Default metalness factor, i.e. 0 = plastic, 1 = metal. */
    readonly metallicFactor: number;

    /** Optional base color texture parameters. */
    readonly baseColorTextureParams?: TextureParams2DUncompressedMipMapped;

    /** Optional normal texture parameters. */
    readonly normalTextureParams?: TextureParams2DUncompressedMipMapped;

    /** Optional metallic/roughness/occlusion texture parameters. */
    readonly metallicRoughnessOcclusionTextureParams?: TextureParams2DUncompressedMipMapped;
}