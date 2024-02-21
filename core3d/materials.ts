import type { Pow2, RGBA } from "webgl2";
import materialIndex from "./materials.json";
import type { RGB } from "./state";

/** @internal */
export const defaultMaterialCommon: PBRMaterialCommon = { width: materialIndex.width as Pow2, height: materialIndex.height as Pow2, mipCount: materialIndex.mipCount };
/** @internal */
export const defaultMaterialParamsRecord = materialIndex.materials as unknown as Readonly<Record<string, PBRMaterialInfo>>;


/** @internal PBR material common info. */
export interface PBRMaterialCommon {
    /** Texture width, power of two, in pixels. */
    readonly width: Pow2;

    /** Texture height, power of two, in pixels. */
    readonly height: Pow2;

    /** # texture mip-maps. */
    readonly mipCount: number;
}

/** @internal PBR material info. */
export interface PBRMaterialInfo {
    // /** Material name/id. */
    // readonly name: string;

    /** Linear scale, i.e. size per "tile" in meters. */
    readonly scale: number;

    /** Default base color factor. */
    readonly albedo: RGB;

    /** Default metalness factor, i.e. 0 = plastic, 1 = metal. */
    readonly metalness: number;

    /** Default roughness factor, i.e. 0 = shiny, 1 = rough. */
    readonly roughness: number;
};

/** @internal PBR material textures. */
export interface PBRMaterialTextures {
    /** Base color texture mip-map pixels. */
    readonly albedoTexture: readonly ArrayBufferView[];

    /** Normal, occlusion, roughness texture mip-map pixels. */
    readonly norTexture: readonly ArrayBufferView[];
}

/** @internal PBR material/texture parameters. */
export interface PBRMaterialParams extends PBRMaterialInfo, PBRMaterialCommon { };

/** @internal PBR material/texture data. */
export interface PBRMaterialData extends PBRMaterialParams, PBRMaterialTextures { };

async function load(file: URL | Blob) {
    if (file instanceof URL) {
        const response = await fetch(file);
        if (response.ok) {
            return await response.arrayBuffer();
        } else {
            throw new Error(`Failed to download "${file.href}" - HTTP error: ${response.status}!`);
        }
    } else {
        return await file.arrayBuffer();
    }
}

function padToNearest(size: number, padding: number): number {
    const n = padding - 1;
    return (size + n) & ~n;
}

type TypedArray = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;
function getMipMaps<T extends TypedArray>(buffer: ArrayBuffer, byteOffset: number, params: PBRMaterialCommon, elementsPerPixel: number, type: T) {
    type U = T["prototype"];
    const mipMaps: U[] = [];
    const { width, height, mipCount } = params;
    let mipSize = width * height * elementsPerPixel;
    for (let i = 0; i < mipCount; i++) {
        const srcView = new type(buffer, byteOffset, mipSize);
        let buf = srcView;
        const byteSize = mipSize * type.BYTES_PER_ELEMENT;
        const paddedByteSize = padToNearest(byteSize, 8);
        if (paddedByteSize != byteSize) {
            // copy buffers that aren't 8 byte aligned into a new, buffer of padded size
            buf = new type(new ArrayBuffer(paddedByteSize));
            buf.set(srcView);
        }
        mipMaps[i] = buf;
        byteOffset += mipSize * type.BYTES_PER_ELEMENT;
        mipSize /= 4;
    }
    return mipMaps;
}

/** @internal */
export async function createPBRMaterial(params: PBRMaterialParams, source: URL | File): Promise<PBRMaterialData> {
    const { width, height, mipCount, scale, albedo, roughness, metalness } = params;
    const buf = await load(source);
    let mipBytes = width * height * 4;
    let totalBytes = 0;
    for (let i = 0; i < mipCount; i++) {
        totalBytes += mipBytes;
        mipBytes /= 4;
    }
    let albedoTexture = await getMipMaps(buf, 0, params, 1, Uint32Array);
    let norTexture = await getMipMaps(buf, totalBytes, params, 4, Uint8Array);
    const matInfo: PBRMaterialData = { scale, width, height, mipCount, albedo, roughness, metalness, albedoTexture, norTexture };
    return matInfo;
}
