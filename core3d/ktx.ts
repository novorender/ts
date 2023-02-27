import type { CubeImages, TextureParams } from "@novorender/webgl2";
import { GL } from "@novorender/webgl2/constants";

const identifier = new Uint8Array([0xAB, 0x4B, 0x54, 0x58, 0x20, 0x31, 0x31, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A]);
const HEADER_LEN = 12 + (13 * 4); // identifier + header elements (not including key value meta-data pairs)

const textureDataType = {
    [GL.UNSIGNED_BYTE]: "UNSIGNED_BYTE",
    [GL.UNSIGNED_SHORT_5_6_5]: "UNSIGNED_SHORT_5_6_5",
    [GL.UNSIGNED_SHORT_4_4_4_4]: "UNSIGNED_SHORT_4_4_4_4",
    [GL.UNSIGNED_SHORT_5_5_5_1]: "UNSIGNED_SHORT_5_5_5_1",
    [GL.HALF_FLOAT]: "HALF_FLOAT",
    // [GL.HALF_FLOAT_OES]: "HALF_FLOAT_OES",
    [GL.FLOAT]: "FLOAT",
    [GL.UNSIGNED_SHORT]: "UNSIGNED_SHORT",
    [GL.UNSIGNED_INT]: "UNSIGNED_INT",
    [GL.UNSIGNED_INT_24_8]: "UNSIGNED_INT_24_8",
    [GL.BYTE]: "BYTE",
    [GL.SHORT]: "SHORT",
    [GL.INT]: "INT",
    // [GL.FLOAT_32_UNSIGNED_INT_24_8_REV]: "FLOAT_32_UNSIGNED_INT_24_8_REV",
    [GL.UNSIGNED_INT_5_9_9_9_REV]: "UNSIGNED_INT_5_9_9_9_REV",
    [GL.UNSIGNED_INT_2_10_10_10_REV]: "UNSIGNED_INT_2_10_10_10_REV",
    [GL.UNSIGNED_INT_10F_11F_11F_REV]: "UNSIGNED_INT_10F_11F_11F_REV",
} as const;
type TextureDataType = keyof typeof textureDataType;

const textureFormatBase = {
    [GL.RGB]: "RGB",
    [GL.RGBA]: "RGBA",
    [GL.ALPHA]: "ALPHA",
    [GL.LUMINANCE]: "LUMINANCE",
    [GL.LUMINANCE_ALPHA]: "LUMINANCE_ALPHA",
    [GL.DEPTH_COMPONENT]: "DEPTH_COMPONENT",
    [GL.DEPTH_STENCIL]: "DEPTH_STENCIL",
    [GL.SRGB_EXT]: "SRGB_EXT",
    [GL.SRGB_ALPHA_EXT]: "SRGB_ALPHA_EXT",
    [GL.RED]: "RED",
    [GL.RG]: "RG",
    [GL.RED_INTEGER]: "RED_INTEGER",
    [GL.RG_INTEGER]: "RG_INTEGER",
    [GL.RGB_INTEGER]: "RGB_INTEGER",
    [GL.RGBA_INTEGER]: "RGBA_INTEGER",
} as const;
type TextureFormatBase = keyof typeof textureFormatBase;

const textureFormatUncompressed = {
    [GL.R8]: "R8",
    [GL.R8_SNORM]: "R8_SNORM",
    [GL.RG8]: "RG8",
    [GL.RG8_SNORM]: "RG8_SNORM",
    [GL.RGB8]: "RGB8",
    [GL.RGB8_SNORM]: "RGB8_SNORM",
    [GL.RGB565]: "RGB565",
    [GL.RGBA4]: "RGBA4",
    [GL.RGB5_A1]: "RGB5_A1",
    [GL.RGBA8]: "RGBA8",
    [GL.RGBA8_SNORM]: "RGBA8_SNORM",
    [GL.RGB10_A2]: "RGB10_A2",
    [GL.RGB10_A2UI]: "RGB10_A2UI",
    [GL.SRGB8]: "SRGB8",
    [GL.SRGB8_ALPHA8]: "SRGB8_ALPHA8",
    [GL.R16F]: "R16F",
    [GL.RG16F]: "RG16F",
    [GL.RGB16F]: "RGB16F",
    [GL.RGBA16F]: "RGBA16F",
    [GL.R32F]: "R32F",
    [GL.RG32F]: "RG32F",
    [GL.RGB32F]: "RGB32F",
    [GL.RGBA32F]: "RGBA32F",
    [GL.R11F_G11F_B10F]: "R11F_G11F_B10F",
    [GL.RGB9_E5]: "RGB9_E5",
    [GL.R8I]: "R8I",
    [GL.R8UI]: "R8UI",
    [GL.R16I]: "R16I",
    [GL.R16UI]: "R16UI",
    [GL.R32I]: "R32I",
    [GL.R32UI]: "R32UI",
    [GL.RG8I]: "RG8I",
    [GL.RG8UI]: "RG8UI",
    [GL.RG16I]: "RG16I",
    [GL.RG16UI]: "RG16UI",
    [GL.RG32I]: "RG32I",
    [GL.RG32UI]: "RG32UI",
    [GL.RGB8I]: "RGB8I",
    [GL.RGB8UI]: "RGB8UI",
    [GL.RGB16I]: "RGB16I",
    [GL.RGB16UI]: "RGB16UI",
    [GL.RGB32I]: "RGB32I",
    [GL.RGB32UI]: "RGB32UI",
    [GL.RGBA8I]: "RGBA8I",
    [GL.RGBA8UI]: "RGBA8UI",
    [GL.RGBA16I]: "RGBA16I",
    [GL.RGBA16UI]: "RGBA16UI",
    [GL.RGBA32I]: "RGBA32I",
    [GL.RGBA32UI]: "RGBA32UI",
    // [GL.SRGB8_ALPHA8_EXT]: "SRGB8_ALPHA8_EXT",
} as const
type TextureFormatUncompressed = keyof typeof textureFormatUncompressed;
type TextureFormatUncompressedString = (typeof textureFormatUncompressed)[TextureFormatUncompressed]

const textureFormatCompressed = {
    [GL.COMPRESSED_RGB_S3TC_DXT1_EXT]: "COMPRESSED_RGB_S3TC_DXT1_EXT",
    [GL.COMPRESSED_RGBA_S3TC_DXT1_EXT]: "COMPRESSED_RGBA_S3TC_DXT1_EXT",
    [GL.COMPRESSED_RGBA_S3TC_DXT3_EXT]: "COMPRESSED_RGBA_S3TC_DXT3_EXT",
    [GL.COMPRESSED_RGBA_S3TC_DXT5_EXT]: "COMPRESSED_RGBA_S3TC_DXT5_EXT",
    [GL.COMPRESSED_R11_EAC]: "COMPRESSED_R11_EAC",
    [GL.COMPRESSED_SIGNED_R11_EAC]: "COMPRESSED_SIGNED_R11_EAC",
    [GL.COMPRESSED_RG11_EAC]: "COMPRESSED_RG11_EAC",
    [GL.COMPRESSED_SIGNED_RG11_EAC]: "COMPRESSED_SIGNED_RG11_EAC",
    [GL.COMPRESSED_RGB8_ETC2]: "COMPRESSED_RGB8_ETC2",
    [GL.COMPRESSED_RGBA8_ETC2_EAC]: "COMPRESSED_RGBA8_ETC2_EAC",
    [GL.COMPRESSED_SRGB8_ETC2]: "COMPRESSED_SRGB8_ETC2",
    [GL.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC]: "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC",
    [GL.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2]: "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2",
    [GL.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2]: "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2",
    [GL.COMPRESSED_RGB_PVRTC_4BPPV1_IMG]: "COMPRESSED_RGB_PVRTC_4BPPV1_IMG",
    [GL.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG]: "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG",
    [GL.COMPRESSED_RGB_PVRTC_2BPPV1_IMG]: "COMPRESSED_RGB_PVRTC_2BPPV1_IMG",
    [GL.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG]: "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG",
    [GL.COMPRESSED_RGB_ETC1_WEBGL]: "COMPRESSED_RGB_ETC1_WEBGL",
    // [GL.COMPRESSED_RGB_ATC_WEBGL]: "COMPRESSED_RGB_ATC_WEBGL",
    // [GL.COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL]: "COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL",
    // [GL.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL]: "COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL",
} as const;
type TextureFormatCompressed = keyof typeof textureFormatCompressed;

const textureFormatInternal = {
    ...textureFormatUncompressed,
    ...textureFormatCompressed,
    // [GL.DEPTH_COMPONENT16]: "DEPTH_COMPONENT16",
    // [GL.DEPTH_COMPONENT24]: "DEPTH_COMPONENT24",
    // [GL.DEPTH_COMPONENT32F]: "DEPTH_COMPONENT32F",
    // [GL.DEPTH32F_STENCIL8]: "DEPTH32F_STENCIL8",
} as const;
type TextureFormatInternal = keyof typeof textureFormatInternal;

function parseHeader(ktx: Uint8Array) {
    const idDataView = new DataView(ktx.buffer, ktx.byteOffset, 12);
    for (let i = 0; i < identifier.length; i++) {
        if (idDataView.getUint8(i) != identifier[i]) {
            throw new Error("texture missing KTX identifier");
        }
    }

    // load the rese of the header in native 32 bit uint
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
