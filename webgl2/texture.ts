import { GL } from "./constants.js";
import { getBufferViewType } from "./misc.js";

export function glCreateTexture(gl: WebGL2RenderingContext, params: TextureParams) {
    const texture = gl.createTexture()!;
    const width = params.width ?? params.image.width;
    const height = params.height ?? params.image.height;
    const target = gl[params.kind];
    const depth = "depth" in params ? params.depth : undefined;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(target, texture);

    const { internalFormat, format, type, arrayType } = getFormatInfo(gl, params.internalFormat, "type" in params ? params.type : undefined);

    type ImageTarget = typeof gl[TextureImageTargetString];

    function textureImage(imgTarget: ImageTarget, data: BufferSource | null, level: number, sizeX: number, sizeY: number, sizeZ = 0) {
        if (!data)
            return;
        const source = data;
        const view = ArrayBuffer.isView(source) ? source : undefined;
        const buffer = ArrayBuffer.isView(view) ? view.buffer : source as ArrayBufferLike;
        const byteOffset = view?.byteOffset ?? 0;
        const byteLength = view?.byteLength ?? buffer?.byteLength;
        const pixels = buffer === null ? null : new arrayType(buffer, byteOffset, byteLength / arrayType.BYTES_PER_ELEMENT);
        const offsetX = 0;
        const offsetY = 0
        const offsetZ = 0;
        if (type) {
            if (sizeZ) {
                gl.texSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, format as number, type, pixels);
            } else {
                gl.texSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, format as number, type, pixels);
            }
        } else {
            if (sizeZ) {
                gl.compressedTexSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, internalFormat, pixels!);
            } else {
                gl.compressedTexSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, internalFormat, pixels!);
            }
        }
    }

    function textureMipLevel(level: number, image: BufferSource | readonly BufferSource[] | null) {
        function isArray(img: typeof image): img is readonly BufferSource[] {
            return Array.isArray(img);
        }
        const n = 1 << level;
        if (isArray(image)) {
            console.assert(target == gl.TEXTURE_CUBE_MAP);
            const cubeImages = image[level];
            if (cubeImages) {
                let side = gl.TEXTURE_CUBE_MAP_POSITIVE_X;
                for (let img of image) {
                    textureImage((side++) as ImageTarget, img, level, width / n, height / n);
                }
            }
        } else {
            if (depth) {
                if (target == gl.TEXTURE_3D) {
                    textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth / n);
                }
                else {
                    console.assert(target == gl.TEXTURE_2D_ARRAY);
                    textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth);
                }
            } else {
                console.assert(target == gl.TEXTURE_2D);
                textureImage(gl.TEXTURE_2D, image, level, width, height);
            }
        }
    }

    function textureStorage(levels: number = 1) {
        if (depth) {
            gl.texStorage3D(target, levels, internalFormat, width, height, depth);
        } else {
            gl.texStorage2D(target, levels, internalFormat, width, height);
        }
    }

    if ("mipMaps" in params) {
        // mip mapped
        const { mipMaps } = params;
        const isNumber = typeof mipMaps == "number";
        const levels = isNumber ? mipMaps : mipMaps.length;
        textureStorage(levels);
        if (!isNumber) {
            for (let level = 0; level < levels; level++) {
                const mipMap = mipMaps[level];
                if (mipMap) {
                    textureMipLevel(level, mipMap);
                }
            }
        }
    } else if (isBufferSource(params.image)) {
        const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
        if (generateMipMaps && !(isPowerOf2(width) && isPowerOf2(height) && type)) {
            throw new Error(`Cannot generate mip maps on a texture of non-power of two sizes (${width}, ${height})!`);
        }
        const levels = generateMipMaps ? Math.log2(Math.min(width, height)) : 1;
        textureStorage(levels);
        textureMipLevel(0, params.image);
        if (generateMipMaps && params.image) {
            gl.generateMipmap(target);
        }
    } else {
        const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format!, type!, params.image as TextureImageSource);
        if (generateMipMaps && isPowerOf2(width) && isPowerOf2(height)) {
            gl.generateMipmap(target);
        }
    }
    gl.bindTexture(target, null);
    return texture;
}

export function glUpdateTexture(gl: WebGL2RenderingContext, targetTexture: WebGLTexture, params: TextureParams) {
    const width = params.width ?? params.image.width;
    const height = params.height ?? params.image.height;
    const target = gl[params.kind];
    const depth = "depth" in params ? params.depth : undefined;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(target, targetTexture);

    const { internalFormat, format, type, arrayType } = getFormatInfo(gl, params.internalFormat, "type" in params ? params.type : undefined);

    type ImageTarget = typeof gl[TextureImageTargetString];

    function textureImage(imgTarget: typeof gl[TextureImageTargetString], data: BufferSource | null, level: number, sizeX: number, sizeY: number, sizeZ = 0) {
        if (!data)
            return;
        const source = data;
        const view = ArrayBuffer.isView(source) ? source : undefined;
        const buffer = ArrayBuffer.isView(view) ? view.buffer : source as ArrayBufferLike;
        const byteOffset = view?.byteOffset ?? 0;
        const byteLength = view?.byteLength ?? buffer?.byteLength;
        const pixels = buffer === null ? null : new arrayType(buffer, byteOffset, byteLength / arrayType.BYTES_PER_ELEMENT);
        const offsetX = 0;
        const offsetY = 0
        const offsetZ = 0;
        if (type) {
            if (sizeZ) {
                gl.texSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, format as number, type, pixels);
            } else {
                gl.texSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, format as number, type, pixels);
            }
        } else {
            if (sizeZ) {
                gl.compressedTexSubImage3D(imgTarget, level, offsetX, offsetY, offsetZ, sizeX, sizeY, sizeZ, internalFormat, pixels!);
            } else {
                gl.compressedTexSubImage2D(imgTarget, level, offsetX, offsetY, sizeX, sizeY, internalFormat, pixels!);
            }
        }
    }

    function textureMipLevel(level: number, image: BufferSource | readonly BufferSource[] | null) {
        function isArray(img: typeof image): img is readonly BufferSource[] {
            return Array.isArray(img);
        }
        const n = 1 << level;
        if (isArray(image)) {
            console.assert(target == gl.TEXTURE_CUBE_MAP);
            const cubeImages = image[level];
            if (cubeImages) {
                let side = gl.TEXTURE_CUBE_MAP_POSITIVE_X;
                for (let img of image) {
                    textureImage((side++) as ImageTarget, img, level, width / n, height / n);
                }
            }
        } else {
            if (depth) {
                if (target == gl.TEXTURE_3D) {
                    textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth / n);
                }
                else {
                    console.assert(target == gl.TEXTURE_2D_ARRAY);
                    textureImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth);
                }
            } else {
                console.assert(target == gl.TEXTURE_2D);
                textureImage(gl.TEXTURE_2D, image, level, width, height);
            }
        }
    }

    if ("mipMaps" in params) {
        // mip mapped
        const { mipMaps } = params;
        const isNumber = typeof mipMaps == "number";
        const levels = isNumber ? mipMaps : mipMaps.length;
        if (!isNumber) {
            for (let level = 0; level < levels; level++) {
                const mipMap = mipMaps[level];
                if (mipMap) {
                    textureMipLevel(level, mipMap);
                }
            }
        }
    } else if (isBufferSource(params.image)) {
        const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
        if (generateMipMaps && !(isPowerOf2(width) && isPowerOf2(height) && type)) {
            throw new Error(`Cannot generate mip maps on a texture of non-power of two sizes (${width}, ${height})!`);
        }
        const levels = generateMipMaps ? Math.log2(Math.min(width, height)) : 1;
        textureMipLevel(0, params.image);
        if (generateMipMaps && params.image) {
            gl.generateMipmap(target);
        }
    } else {
        const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format!, type!, params.image as TextureImageSource);
        if (generateMipMaps && isPowerOf2(width) && isPowerOf2(height)) {
            gl.generateMipmap(target);
        }
    }
    gl.bindTexture(target, null);
}

function isPowerOf2(value: number) {
    return (value & (value - 1)) == 0;
}

function isFormatCompressed(format: UncompressedTextureFormatString | CompressedTextureFormatString): format is CompressedTextureFormatString {
    return format.startsWith("COMPRESSED");
}

function isBufferSource(image: unknown): image is BufferSource {
    return image == undefined || Array.isArray(image) || image instanceof ArrayBuffer || ArrayBuffer.isView(image);
}

function getFormatInfo(gl: WebGL2RenderingContext, internalFormatString: UncompressedTextureFormatString | CompressedTextureFormatString, typeString?: TexelTypeString) {
    if (isFormatCompressed(internalFormatString)) {
        const internalFormat = compressedFormats[internalFormatString];
        const format = undefined;
        const type = undefined;
        const arrayType = Uint8Array;
        return { internalFormat, format, type, arrayType };
    } else {
        const internalFormat = gl[internalFormatString] as keyof typeof internalFormat2FormatLookup;
        const format = internalFormat2FormatLookup[internalFormat];
        const type = gl[typeString!];
        const arrayType = getBufferViewType(typeString!);
        return { internalFormat, format, type, arrayType };
    }
}

export const textureDataType = {
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
export type TextureDataType = keyof typeof textureDataType;

export const textureFormatBase = {
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
export type TextureFormatBase = keyof typeof textureFormatBase;

export const textureFormatUncompressed = {
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
    [GL.DEPTH_COMPONENT16]: "DEPTH_COMPONENT16",
    [GL.DEPTH_COMPONENT24]: "DEPTH_COMPONENT24",
    [GL.DEPTH_COMPONENT32F]: "DEPTH_COMPONENT32F",
    [GL.DEPTH24_STENCIL8]: "DEPTH24_STENCIL8",
    [GL.DEPTH32F_STENCIL8]: "DEPTH32F_STENCIL8",
    // [GL.SRGB8_ALPHA8_EXT]: "SRGB8_ALPHA8_EXT",
} as const
export type UncompressedTextureFormat = keyof typeof textureFormatUncompressed;
export type UncompressedTextureFormatString = (typeof textureFormatUncompressed)[UncompressedTextureFormat]

const textureFormatCompressed = {
    // WEBGL_compressed_texture_s3tc
    [GL.COMPRESSED_RGB_S3TC_DXT1_EXT]: "COMPRESSED_RGB_S3TC_DXT1_EXT",
    [GL.COMPRESSED_RGBA_S3TC_DXT1_EXT]: "COMPRESSED_RGBA_S3TC_DXT1_EXT",
    [GL.COMPRESSED_RGBA_S3TC_DXT3_EXT]: "COMPRESSED_RGBA_S3TC_DXT3_EXT",
    [GL.COMPRESSED_RGBA_S3TC_DXT5_EXT]: "COMPRESSED_RGBA_S3TC_DXT5_EXT",

    // WEBGL_compressed_texture_s3tc_srgb
    [GL.COMPRESSED_SRGB_S3TC_DXT1_EXT]: "COMPRESSED_SRGB_S3TC_DXT1_EXT",
    [GL.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT]: "COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT",
    [GL.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT]: "COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT",
    [GL.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT]: "COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT",

    // WEBGL_compressed_texture_etc
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

    // WEBGL_compressed_texture_pvrtc
    [GL.COMPRESSED_RGB_PVRTC_4BPPV1_IMG]: "COMPRESSED_RGB_PVRTC_4BPPV1_IMG",
    [GL.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG]: "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG",
    [GL.COMPRESSED_RGB_PVRTC_2BPPV1_IMG]: "COMPRESSED_RGB_PVRTC_2BPPV1_IMG",
    [GL.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG]: "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG",

    // WEBGL_compressed_texture_etc1
    [GL.COMPRESSED_RGB_ETC1_WEBGL]: "COMPRESSED_RGB_ETC1_WEBGL",

    // WEBGL_compressed_texture_astc
    [GL.COMPRESSED_RGBA_ASTC_4x4_KHR]: "COMPRESSED_RGBA_ASTC_4x4_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR",
    [GL.COMPRESSED_RGBA_ASTC_5x4_KHR]: "COMPRESSED_RGBA_ASTC_5x4_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR",
    [GL.COMPRESSED_RGBA_ASTC_5x5_KHR]: "COMPRESSED_RGBA_ASTC_5x5_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR",
    [GL.COMPRESSED_RGBA_ASTC_6x5_KHR]: "COMPRESSED_RGBA_ASTC_6x5_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR",
    [GL.COMPRESSED_RGBA_ASTC_6x6_KHR]: "COMPRESSED_RGBA_ASTC_6x6_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR",
    [GL.COMPRESSED_RGBA_ASTC_8x5_KHR]: "COMPRESSED_RGBA_ASTC_8x5_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR",
    [GL.COMPRESSED_RGBA_ASTC_8x6_KHR]: "COMPRESSED_RGBA_ASTC_8x6_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR",
    [GL.COMPRESSED_RGBA_ASTC_8x8_KHR]: "COMPRESSED_RGBA_ASTC_8x8_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR",
    [GL.COMPRESSED_RGBA_ASTC_10x5_KHR]: "COMPRESSED_RGBA_ASTC_10x5_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR",
    [GL.COMPRESSED_RGBA_ASTC_10x6_KHR]: "COMPRESSED_RGBA_ASTC_10x6_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR",
    [GL.COMPRESSED_RGBA_ASTC_10x10_KHR]: "COMPRESSED_RGBA_ASTC_10x10_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR",
    [GL.COMPRESSED_RGBA_ASTC_12x10_KHR]: "COMPRESSED_RGBA_ASTC_12x10_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR",
    [GL.COMPRESSED_RGBA_ASTC_12x12_KHR]: "COMPRESSED_RGBA_ASTC_12x12_KHR",
    [GL.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR]: "COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR",

    // EXT_texture_compression_bptc
    [GL.COMPRESSED_RGBA_BPTC_UNORM_EXT]: "COMPRESSED_RGBA_BPTC_UNORM_EXT",
    [GL.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT]: "COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT",
    [GL.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT]: "COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT",
    [GL.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT]: "COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT",

    // EXT_texture_compression_rgtc
    [GL.COMPRESSED_RED_RGTC1_EXT]: "COMPRESSED_RED_RGTC1_EXT",
    [GL.COMPRESSED_SIGNED_RED_RGTC1_EXT]: "COMPRESSED_SIGNED_RED_RGTC1_EXT",
    [GL.COMPRESSED_RED_GREEN_RGTC2_EXT]: "COMPRESSED_RED_GREEN_RGTC2_EXT",
    [GL.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT]: "COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT",
} as const;
export type CompressedTextureFormat = keyof typeof textureFormatCompressed;
export type CompressedTextureFormatString = (typeof textureFormatCompressed)[CompressedTextureFormat]

export const textureFormatInternal = {
    ...textureFormatUncompressed,
    ...textureFormatCompressed,
} as const;
export type TextureFormatInternal = keyof typeof textureFormatInternal;

export type TextureParams =
    TextureParams2DUncompressedImage | TextureParams2DUncompressed | TextureParams2DCompressed | TextureParams2DUncompressedMipMapped | TextureParams2DCompressedMipMapped |
    TextureParamsCubeUncompressed | TextureParamsCubeCompressed | TextureParamsCubeUncompressedMipMapped | TextureParamsCubeCompressedMipMapped |
    TextureParams3DUncompressed | TextureParams3DCompressed | TextureParams3DUncompressedMipMapped | TextureParams3DCompressedMipMapped |
    TextureParams2DArrayUncompressed | TextureParams2DArrayCompressed | TextureParams2DArrayUncompressedMipMapped | TextureParams2DArrayCompressedMipMapped;

export type TextureTargetString = TextureParams["kind"];

export type TextureImageSource = ImageBitmap | ImageData | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | OffscreenCanvas;

// 2D
export type TextureParams2DUncompressedImage = Uncompressed & Partial<Size2D> & GenMipMap & {
    readonly kind: "TEXTURE_2D";
    readonly image: TextureImageSource;
};

export type TextureParams2DUncompressed = Uncompressed & Size2D & GenMipMap & {
    readonly kind: "TEXTURE_2D";
    readonly image: BufferSource | TextureImageSource | null;
};

export interface TextureParams2DCompressed extends Compressed, Size2D {
    readonly kind: "TEXTURE_2D";
    readonly image: BufferSource;
};

export type TextureParams2DUncompressedMipMapped = Uncompressed & Size2D<Pow2> & GenMipMap & {
    readonly kind: "TEXTURE_2D";
    readonly mipMaps: number | readonly (BufferSource | null)[];
};

export interface TextureParams2DCompressedMipMapped extends Compressed, Size2D<Pow2> {
    readonly kind: "TEXTURE_2D";
    readonly mipMaps: readonly (BufferSource)[];
};

// Cube
export type TextureParamsCubeUncompressed = Uncompressed & Size2D & GenMipMap & {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly image: CubeImages | null;
}

export interface TextureParamsCubeCompressed extends Compressed, Size2D {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly image: CubeImages;
}

export type TextureParamsCubeUncompressedMipMapped = Uncompressed & Size2D<Pow2> & {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly mipMaps: number | readonly (CubeImages | null)[];
}

export interface TextureParamsCubeCompressedMipMapped extends Compressed, Size2D<Pow2> {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly mipMaps: readonly (CubeImages)[];
}

// 3D
export type TextureParams3DUncompressed = Uncompressed & Size3D & GenMipMap & {
    readonly kind: "TEXTURE_3D";
    readonly image: BufferSource | null;
}

export interface TextureParams3DCompressed extends Compressed, Size3D {
    readonly kind: "TEXTURE_3D";
    readonly image: BufferSource;
}

export type TextureParams3DUncompressedMipMapped = Uncompressed & Size3D<Pow2> & {
    readonly kind: "TEXTURE_3D";
    readonly mipMaps: number | readonly (BufferSource | null)[];
}

export interface TextureParams3DCompressedMipMapped extends Compressed, Size3D<Pow2> {
    readonly kind: "TEXTURE_3D";
    readonly mipMaps: readonly (BufferSource)[];
}

// 2D Array
export type TextureParams2DArrayUncompressed = Uncompressed & Size3D & GenMipMap & {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly image: BufferSource | null;
}

export interface TextureParams2DArrayCompressed extends Compressed, Size3D {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly image: BufferSource;
}

export type TextureParams2DArrayUncompressedMipMapped = Uncompressed & Size3D<Pow2> & {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly mipMaps: number | readonly (BufferSource | null)[];
}

export interface TextureParams2DArrayCompressedMipMapped extends Compressed, Size3D<Pow2> {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly mipMaps: readonly (BufferSource)[];
}

export type TextureImageTargetString = "TEXTURE_2D" | "TEXTURE_3D" | "TEXTURE_2D_ARRAY" | "TEXTURE_CUBE_MAP_POSITIVE_X" | "TEXTURE_CUBE_MAP_NEGATIVE_X" | "TEXTURE_CUBE_MAP_POSITIVE_Y" | "TEXTURE_CUBE_MAP_NEGATIVE_Y" | "TEXTURE_CUBE_MAP_POSITIVE_Z" | "TEXTURE_CUBE_MAP_NEGATIVE_Z";

// https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glTexStorage2D.xhtml
export type UncompressedTextureFormatType =
    { internalFormat: "R8", type: "UNSIGNED_BYTE" } |
    { internalFormat: "R8_SNORM", type: "BYTE" } |
    { internalFormat: "R16F", type: "HALF_FLOAT" | "FLOAT" } |
    { internalFormat: "R32F", type: "FLOAT" } |
    { internalFormat: "R8UI", type: "UNSIGNED_BYTE" } |
    { internalFormat: "R8I", type: "BYTE" } |
    { internalFormat: "R16UI", type: "UNSIGNED_SHORT" } |
    { internalFormat: "R16I", type: "SHORT" } |
    { internalFormat: "R32UI", type: "UNSIGNED_INT" } |
    { internalFormat: "R32I", type: "INT" } |
    { internalFormat: "RG8", type: "UNSIGNED_BYTE" } |
    { internalFormat: "RG8_SNORM", type: "BYTE" } |
    { internalFormat: "RG16F", type: "HALF_FLOAT" | "FLOAT" } |
    { internalFormat: "RG32F", type: "FLOAT" } |
    { internalFormat: "RG8UI", type: "UNSIGNED_BYTE" } |
    { internalFormat: "RG8I", type: "BYTE" } |
    { internalFormat: "RG16UI", type: "UNSIGNED_SHORT" } |
    { internalFormat: "RG16I", type: "SHORT" } |
    { internalFormat: "RG32UI", type: "UNSIGNED_INT" } |
    { internalFormat: "RG32I", type: "INT" } |
    { internalFormat: "RGB8", type: "UNSIGNED_BYTE" } |
    { internalFormat: "SRGB8", type: "UNSIGNED_BYTE" } |
    { internalFormat: "RGB565", type: "UNSIGNED_BYTE" | "UNSIGNED_SHORT_5_6_5" } |
    { internalFormat: "RGB8_SNORM", type: "BYTE" } |
    { internalFormat: "R11F_G11F_B10F", type: "UNSIGNED_INT_10F_11F_11F_REV" | "HALF_FLOAT" | "FLOAT" } |
    { internalFormat: "RGB9_E5", type: "UNSIGNED_INT_5_9_9_9_REV" | "HALF_FLOAT" | "FLOAT" } |
    { internalFormat: "RGB16F", type: "HALF_FLOAT" | "FLOAT" } |
    { internalFormat: "RGB32F", type: "FLOAT" } |
    { internalFormat: "RGB8UI", type: "UNSIGNED_BYTE" } |
    { internalFormat: "RGB8I", type: "BYTE" } |
    { internalFormat: "RGB16UI", type: "UNSIGNED_SHORT" } |
    { internalFormat: "RGB16I", type: "SHORT" } |
    { internalFormat: "RGB32UI", type: "UNSIGNED_INT" } |
    { internalFormat: "RGB32I", type: "INT" } |
    { internalFormat: "RGBA8", type: "UNSIGNED_BYTE" } |
    { internalFormat: "SRGB8_ALPHA8", type: "UNSIGNED_BYTE" } |
    { internalFormat: "RGBA8_SNORM", type: "BYTE" } |
    { internalFormat: "RGB5_A1", type: "UNSIGNED_BYTE" | "UNSIGNED_SHORT_5_5_5_1" | "UNSIGNED_INT_2_10_10_10_REV" } |
    { internalFormat: "RGBA4", type: "UNSIGNED_BYTE" | "UNSIGNED_SHORT_4_4_4_4" } |
    { internalFormat: "RGB10_A2", type: "UNSIGNED_INT_2_10_10_10_REV" } |
    { internalFormat: "RGBA16F", type: "HALF_FLOAT" | "FLOAT" } |
    { internalFormat: "RGBA32F", type: "FLOAT" } |
    { internalFormat: "RGBA8UI", type: "UNSIGNED_BYTE" } |
    { internalFormat: "RGBA8I", type: "BYTE" } |
    { internalFormat: "RGB10_A2UI", type: "UNSIGNED_INT_2_10_10_10_REV" } |
    { internalFormat: "RGBA16UI", type: "UNSIGNED_SHORT" } |
    { internalFormat: "RGBA16I", type: "SHORT" } |
    { internalFormat: "RGBA32I", type: "INT" } |
    { internalFormat: "RGBA32UI", type: "UNSIGNED_INT" } |
    { internalFormat: "DEPTH_COMPONENT16", type: "UNSIGNED_SHORT" } |
    { internalFormat: "DEPTH_COMPONENT24", type: "UNSIGNED_INT" } |
    { internalFormat: "DEPTH_COMPONENT32F", type: "FLOAT" } |
    { internalFormat: "DEPTH24_STENCIL8", type: "UNSIGNED_INT_24_8" } |
    { internalFormat: "DEPTH32F_STENCIL8", type: "FLOAT_32_UNSIGNED_INT_24_8_REV" }; // FLOAT_32_UNSIGNED_INT_24_8_REV is for reading z-buffer and can't be created from an image: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/texImage3D;

export type TexelTypeString = UncompressedTextureFormatType["type"];

export type Pow2 = 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32758 | 65536;
export type CubeImages = readonly [posX: BufferSource, negX: BufferSource, posY: BufferSource, negZ: BufferSource, posZ: BufferSource, negZ: BufferSource];

type Uncompressed = UncompressedTextureFormatType;

interface Compressed {
    readonly internalFormat: CompressedTextureFormatString;
}

interface GenMipMap {
    readonly generateMipMaps?: boolean; //  default: false. Mip maps can only be created for textures with power of 2 sizes.
}

interface Size2D<T extends number = number> {
    readonly width: T;
    readonly height: T;
}

interface Size3D<T extends number = number> {
    readonly width: T;
    readonly height: T;
    readonly depth: T;
}

// https://www.khronos.org/registry/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
const internalFormat2FormatLookup = {
    [GL.RGB]: GL.RGB,
    [GL.RGBA]: GL.RGBA,
    [GL.LUMINANCE_ALPHA]: GL.LUMINANCE_ALPHA,
    [GL.LUMINANCE]: GL.LUMINANCE,
    [GL.ALPHA]: GL.ALPHA,
    [GL.R8]: GL.RED,
    [GL.R8_SNORM]: GL.RED,
    [GL.RG8]: GL.RG,
    [GL.RG8_SNORM]: GL.RG,
    [GL.RGB8]: GL.RGB,
    [GL.RGB8_SNORM]: GL.RGB,
    [GL.RGB565]: GL.RGB,
    [GL.RGBA4]: GL.RGBA,
    [GL.RGB5_A1]: GL.RGBA,
    [GL.RGBA8]: GL.RGBA,
    [GL.RGBA8_SNORM]: GL.RGBA,
    [GL.RGB10_A2]: GL.RGBA,
    [GL.RGB10_A2UI]: GL.RGBA_INTEGER,
    [GL.SRGB8]: GL.RGB,
    [GL.SRGB8_ALPHA8]: GL.RGBA,
    [GL.R16F]: GL.RED,
    [GL.RG16F]: GL.RG,
    [GL.RGB16F]: GL.RGB,
    [GL.RGBA16F]: GL.RGBA,
    [GL.R32F]: GL.RED,
    [GL.RG32F]: GL.RG,
    [GL.RGB32F]: GL.RGB,
    [GL.RGBA32F]: GL.RGBA,
    [GL.R11F_G11F_B10F]: GL.RGB,
    [GL.RGB9_E5]: GL.RGB,
    [GL.R8I]: GL.RED_INTEGER,
    [GL.R8UI]: GL.RED_INTEGER,
    [GL.R16I]: GL.RED_INTEGER,
    [GL.R16UI]: GL.RED_INTEGER,
    [GL.R32I]: GL.RED_INTEGER,
    [GL.R32UI]: GL.RED_INTEGER,
    [GL.RG8I]: GL.RG_INTEGER,
    [GL.RG8UI]: GL.RG_INTEGER,
    [GL.RG16I]: GL.RG_INTEGER,
    [GL.RG16UI]: GL.RG_INTEGER,
    [GL.RG32I]: GL.RG_INTEGER,
    [GL.RG32UI]: GL.RG_INTEGER,
    [GL.RGB8I]: GL.RGB_INTEGER,
    [GL.RGB8UI]: GL.RGB_INTEGER,
    [GL.RGB16I]: GL.RGB_INTEGER,
    [GL.RGB16UI]: GL.RGB_INTEGER,
    [GL.RGB32I]: GL.RGB_INTEGER,
    [GL.RGB32UI]: GL.RGB_INTEGER,
    [GL.RGBA8I]: GL.RGBA_INTEGER,
    [GL.RGBA8UI]: GL.RGBA_INTEGER,
    [GL.RGBA16I]: GL.RGBA_INTEGER,
    [GL.RGBA16UI]: GL.RGBA_INTEGER,
    [GL.RGBA32I]: GL.RGBA_INTEGER,
    [GL.RGBA32UI]: GL.RGBA_INTEGER,
    [GL.DEPTH_COMPONENT16]: GL.DEPTH_COMPONENT,
    [GL.DEPTH_COMPONENT24]: GL.DEPTH_COMPONENT,
    [GL.DEPTH_COMPONENT32F]: GL.DEPTH_COMPONENT,
    [GL.DEPTH24_STENCIL8]: GL.DEPTH_STENCIL,
    [GL.DEPTH32F_STENCIL8]: GL.DEPTH_STENCIL,
} as const;

// we could read these from extensions instead...
const compressedFormats = {
    // WEBGL_compressed_texture_s3tc
    COMPRESSED_RGB_S3TC_DXT1_EXT: GL.COMPRESSED_RGB_S3TC_DXT1_EXT,
    COMPRESSED_RGBA_S3TC_DXT1_EXT: GL.COMPRESSED_RGBA_S3TC_DXT1_EXT,
    COMPRESSED_RGBA_S3TC_DXT3_EXT: GL.COMPRESSED_RGBA_S3TC_DXT3_EXT,
    COMPRESSED_RGBA_S3TC_DXT5_EXT: GL.COMPRESSED_RGBA_S3TC_DXT5_EXT,
    // WEBGL_compressed_texture_s3tc_srgb
    COMPRESSED_SRGB_S3TC_DXT1_EXT: GL.COMPRESSED_SRGB_S3TC_DXT1_EXT,
    COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT: GL.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT,
    COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT: GL.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT,
    COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT: GL.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT,
    // WEBGL_compressed_texture_etc
    COMPRESSED_R11_EAC: GL.COMPRESSED_R11_EAC,
    COMPRESSED_SIGNED_R11_EAC: GL.COMPRESSED_SIGNED_R11_EAC,
    COMPRESSED_RG11_EAC: GL.COMPRESSED_RG11_EAC,
    COMPRESSED_SIGNED_RG11_EAC: GL.COMPRESSED_SIGNED_RG11_EAC,
    COMPRESSED_RGB8_ETC2: GL.COMPRESSED_RGB8_ETC2,
    COMPRESSED_RGBA8_ETC2_EAC: GL.COMPRESSED_RGBA8_ETC2_EAC,
    COMPRESSED_SRGB8_ETC2: GL.COMPRESSED_SRGB8_ETC2,
    COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: GL.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC,
    COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2: GL.COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2,
    COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2: GL.COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2,
    // WEBGL_compressed_texture_pvrtc
    COMPRESSED_RGB_PVRTC_4BPPV1_IMG: GL.COMPRESSED_RGB_PVRTC_4BPPV1_IMG,
    COMPRESSED_RGBA_PVRTC_4BPPV1_IMG: GL.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG,
    COMPRESSED_RGB_PVRTC_2BPPV1_IMG: GL.COMPRESSED_RGB_PVRTC_2BPPV1_IMG,
    COMPRESSED_RGBA_PVRTC_2BPPV1_IMG: GL.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG,
    // WEBGL_compressed_texture_etc1
    COMPRESSED_RGB_ETC1_WEBGL: GL.COMPRESSED_RGB_ETC1_WEBGL,
    // WEBGL_compressed_texture_astc
    COMPRESSED_RGBA_ASTC_4x4_KHR: GL.COMPRESSED_RGBA_ASTC_4x4_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR,
    COMPRESSED_RGBA_ASTC_5x4_KHR: GL.COMPRESSED_RGBA_ASTC_5x4_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR,
    COMPRESSED_RGBA_ASTC_5x5_KHR: GL.COMPRESSED_RGBA_ASTC_5x5_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR,
    COMPRESSED_RGBA_ASTC_6x5_KHR: GL.COMPRESSED_RGBA_ASTC_6x5_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR,
    COMPRESSED_RGBA_ASTC_6x6_KHR: GL.COMPRESSED_RGBA_ASTC_6x6_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR,
    COMPRESSED_RGBA_ASTC_8x5_KHR: GL.COMPRESSED_RGBA_ASTC_8x5_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR,
    COMPRESSED_RGBA_ASTC_8x6_KHR: GL.COMPRESSED_RGBA_ASTC_8x6_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR,
    COMPRESSED_RGBA_ASTC_8x8_KHR: GL.COMPRESSED_RGBA_ASTC_8x8_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR,
    COMPRESSED_RGBA_ASTC_10x5_KHR: GL.COMPRESSED_RGBA_ASTC_10x5_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR,
    COMPRESSED_RGBA_ASTC_10x6_KHR: GL.COMPRESSED_RGBA_ASTC_10x6_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR,
    COMPRESSED_RGBA_ASTC_10x10_KHR: GL.COMPRESSED_RGBA_ASTC_10x10_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR,
    COMPRESSED_RGBA_ASTC_12x10_KHR: GL.COMPRESSED_RGBA_ASTC_12x10_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR,
    COMPRESSED_RGBA_ASTC_12x12_KHR: GL.COMPRESSED_RGBA_ASTC_12x12_KHR,
    COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR: GL.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR,
    // EXT_texture_compression_bptc
    COMPRESSED_RGBA_BPTC_UNORM_EXT: GL.COMPRESSED_RGBA_BPTC_UNORM_EXT,
    COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT: GL.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT,
    COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT: GL.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT,
    COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT: GL.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT,
    // EXT_texture_compression_rgtc
    COMPRESSED_RED_RGTC1_EXT: GL.COMPRESSED_RED_RGTC1_EXT,
    COMPRESSED_SIGNED_RED_RGTC1_EXT: GL.COMPRESSED_SIGNED_RED_RGTC1_EXT,
    COMPRESSED_RED_GREEN_RGTC2_EXT: GL.COMPRESSED_RED_GREEN_RGTC2_EXT,
    COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT: GL.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT,
} as const;
