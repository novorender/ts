import type { Pow2 } from "webgl2";
import type { ActiveTexturesArray, RGB } from "./state";
import type { DeviceProfile } from "./device";

/** @internal */
export function getMaterialCommon(deviceProfile: DeviceProfile): PBRMaterialCommon | undefined {
    const { materialTextureResolution } = deviceProfile;
    if (materialTextureResolution != null) {
        // TODO: Adjust sizes/mips according to device profile! -> implement varying sizes!
        return { width: 1024, height: 1024, mipCount: 11 };
    }
}

/** @internal */
export function emptyActiveTexturesArray(): ActiveTexturesArray {
    return [null, null, null, null, null, null, null, null, null, null] as unknown as ActiveTexturesArray;
}

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

async function load(source: URL | Blob) {
    if (source instanceof URL) {
        const response = await fetch(source);
        if (response.ok) {
            return await response.arrayBuffer();
        } else {
            throw new Error(`Failed to download "${source.href}" - HTTP error: ${response.status}!`);
        }
    } else {
        return await source.arrayBuffer();
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
export async function createPBRMaterial(params: PBRMaterialCommon, source: URL | File): Promise<PBRMaterialTextures> {
    const { width, height, mipCount } = params;
    const buf = await load(source);
    let mipBytes = width * height * 4;
    let totalBytes = 0;
    for (let i = 0; i < mipCount; i++) {
        totalBytes += mipBytes;
        mipBytes /= 4;
    }
    let albedoTexture = await getMipMaps(buf, 0, params, 1, Uint32Array);
    let norTexture = await getMipMaps(buf, totalBytes, params, 4, Uint8Array);
    const matInfo: PBRMaterialTextures = { albedoTexture, norTexture };
    return matInfo;
}
