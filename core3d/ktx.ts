import type { CubeImages, TextureParams, TextureDataType, TextureFormatBase, TextureFormatInternal } from "webgl2";
import { textureFormatInternal, textureFormatBase, textureDataType } from "webgl2";

const identifier = new Uint8Array([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A]);
const HEADER_LEN = 12 + (13 * 4); // identifier + header elements (not including key value meta-data pairs)


function parseHeader(ktx: Uint8Array) {
    const idDataView = new DataView(ktx.buffer, ktx.byteOffset, 12);
    for (let i = 0; i < identifier.length; i++) {
        if (idDataView.getUint8(i) != identifier[i]) {
            throw new Error("texture missing KTX identifier");
        }
    }

    // load the rest of the header in native 32 bit uint
    const dataSize = Uint32Array.BYTES_PER_ELEMENT;
    const headerDataView = new DataView(ktx.buffer, 12 + ktx.byteOffset, 13 * dataSize);
    const endianness = headerDataView.getUint32(0, true);
    const littleEndian = endianness === 0x04030201;

    return {
        glType: headerDataView.getUint32(1 * dataSize, littleEndian) as 0 | TextureDataType,// must be 0 for compressed textures
        glTypeSize: headerDataView.getUint32(2 * dataSize, littleEndian), // must be 1 for compressed textures
        glFormat: headerDataView.getUint32(3 * dataSize, littleEndian) as 0 | TextureFormatBase, // must be 0 for compressed textures
        glInternalFormat: headerDataView.getUint32(4 * dataSize, littleEndian) as TextureFormatInternal, // the value of arg passed to gl.texImage2D() or gl.compressedTexImage2D(,,x,,,,)
        glBaseInternalFormat: headerDataView.getUint32(5 * dataSize, littleEndian) as TextureFormatBase, // specify GL_RGB, GL_RGBA, GL_ALPHA, etc (un-compressed only)
        pixelWidth: headerDataView.getUint32(6 * dataSize, littleEndian), // level 0 value of arg passed to gl.compressedTexImage2D(,,,x,,,)
        pixelHeight: headerDataView.getUint32(7 * dataSize, littleEndian), // level 0 value of arg passed to gl.compressedTexImage2D(,,,,x,,)
        pixelDepth: headerDataView.getUint32(8 * dataSize, littleEndian), // level 0 value of arg passed to gl.compressedTexImage3D(,,,,,x,,)
        numberOfArrayElements: headerDataView.getUint32(9 * dataSize, littleEndian), // used for texture arrays
        numberOfFaces: headerDataView.getUint32(10 * dataSize, littleEndian), // used for cubemap textures, should either be 1 or 6
        numberOfMipmapLevels: headerDataView.getUint32(11 * dataSize, littleEndian), // number of levels; disregard possibility of 0 for compressed textures
        bytesOfKeyValueData: headerDataView.getUint32(12 * dataSize, littleEndian), // the amount of space after the header for meta-data
        littleEndian,
    };
}

type Header = ReturnType<typeof parseHeader>;

function* getImages(header: Header, ktx: Uint8Array, littleEndian: boolean) {
    const mips = Math.max(1, header.numberOfMipmapLevels);
    const elements = Math.max(1, header.numberOfArrayElements);
    const faces = header.numberOfFaces;
    const depth = Math.max(1, header.pixelDepth);
    let dataOffset = HEADER_LEN + header.bytesOfKeyValueData;
    const imageSizeDenom = (faces == 6 && header.numberOfArrayElements == 0) ? 1 : elements * faces * depth;
    const dataView = new DataView(ktx.buffer, ktx.byteOffset);

    for (let mip = 0; mip < mips; mip++) {
        const width = header.pixelWidth >> mip;
        const height = header.pixelHeight >> mip;
        const imageSize = dataView.getInt32(dataOffset, littleEndian);
        dataOffset += 4;
        const imageStride = imageSize / imageSizeDenom;
        console.assert(imageStride % 4 == 0);
        for (let element = 0; element < elements; element++) {
            for (let face = 0; face < faces; face++) {
                for (let z_slice = 0; z_slice < depth; z_slice++) {
                    // const target = faces == 6 ? GL.TEXTURE_CUBE_MAP_POSITIVE_X + face : GL.TEXTURE_2D;
                    const begin = dataOffset;
                    dataOffset += imageStride;
                    const end = dataOffset;
                    const image = { mip, element, face, width, height, blobRange: [begin, end], buffer: ktx.subarray(begin, end) } as const;
                    yield image;
                }
            }
        }
    }
    console.assert(dataOffset == ktx.byteLength);
}

/** @internal */
export function parseKTX(ktx: Uint8Array): TextureParams {
    const header = parseHeader(ktx);
    const { littleEndian } = header;
    const baseFormat = textureFormatBase[header.glBaseInternalFormat]; // we don't really need this here (but may be useful for debugging).
    const isArray = header.numberOfArrayElements > 0;
    const isCube = header.numberOfFaces == 6;
    const is3D = header.pixelDepth > 0;
    const hasMips = header.numberOfMipmapLevels > 1;
    const numMips = Math.max(1, header.numberOfMipmapLevels);
    const internalFormat = textureFormatInternal[header.glInternalFormat];
    const kind = isArray ? "TEXTURE_ARRAY" : isCube ? "TEXTURE_CUBE_MAP" : is3D ? "TEXTURE_3D" : "TEXTURE_2D";
    const type = header.glType ? textureDataType[header.glType] : undefined;
    const dim = { width: header.pixelWidth, height: header.pixelHeight, ...(is3D ? { depth: header.pixelDepth } : undefined) };
    let mips: CubeImages[] | BufferSource[] = undefined!;
    if (isCube) {
        const images = new Array(numMips).fill(null).map(_ => ([] as any[]));
        for (const image of getImages(header, ktx, littleEndian)) {
            images[image.mip][image.face] = image.buffer;
        }
        mips = images as unknown as CubeImages[];
    } else {
        mips = new Array<BufferSource>(numMips);
        for (const image of getImages(header, ktx, littleEndian)) {
            mips[image.mip] = image.buffer;
        }
    }
    const imageData = hasMips ? { mipMaps: mips } as const : { image: mips[0] } as const;
    return {
        kind,
        internalFormat,
        type: type,
        ...dim,
        ...imageData,
    } as TextureParams;
    // throw new Error("UnsupportedKTX format!");
}
