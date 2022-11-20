import type { CompressedTextureFormatString, TexelTypeString, TextureImageTargetString, TextureParams, UncompressedTextureFormatString } from "./types";
import type { RendererContext } from ".";
import { GL } from "./glEnum.js";
import { getBufferViewType } from "./util.js";

export function createTexture(context: RendererContext, params: TextureParams) {
    const { gl } = context;
    const texture = gl.createTexture();
    if (!texture)
        throw new Error("Could not create texture!");

    const { width, height } = params;
    const target = gl[params.kind];
    const depth = "depth" in params ? params.depth : undefined;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(target, texture);

    const { internalFormat, format, type, arrayType } = getFormatInfo(gl, params.internalFormat, "type" in params ? params.type : undefined);

    function createImage(imgTarget: typeof gl[TextureImageTargetString], data: BufferSource | null, level: number, sizeX: number, sizeY: number, sizeZ = 0) {
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

    function createMipLevel(level: number, image: BufferSource | readonly BufferSource[] | null) {
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
                    createImage(side++, img, level, width / n, height / n);
                }
            }
        } else {
            if (depth) {
                if (target == gl.TEXTURE_3D) {
                    createImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth / n);
                }
                else {
                    console.assert(target == gl.TEXTURE_2D_ARRAY);
                    createImage(gl.TEXTURE_3D, image, level, width / n, height / n, depth);
                }
            } else {
                console.assert(target == gl.TEXTURE_2D);
                createImage(gl.TEXTURE_2D, image, level, width, height);
            }
        }
    }

    function createStorage(levels: number = 1) {
        if (depth) {
            gl.texStorage3D(target, levels, internalFormat, width, height, depth);
        } else {
            gl.texStorage2D(target, levels, internalFormat, width, height);
        }
    }

    if ("mipMaps" in params) {
        // mip mapped
        const { mipMaps } = params;
        const levels = mipMaps.length;
        createStorage(levels);
        for (let level = 0; level < levels; level++) {
            const mipMap = mipMaps[level];
            if (mipMap) {
                createMipLevel(level, mipMap);
            }
        }
    } else {
        const generateMipMaps = "generateMipMaps" in params && params.generateMipMaps;
        if (generateMipMaps && !(isPowerOf2(width) && isPowerOf2(height) && type)) {
            throw new Error(`Cannot generate mip maps on a texture of non-power of two sizes (${width}, ${height})!`);
        }
        const levels = generateMipMaps ? Math.log2(Math.min(width, height)) : 1;
        createStorage(levels);
        createMipLevel(0, params.image);
        if (generateMipMaps && params.image) {
            gl.generateMipmap(target);
        }
    }
    gl.bindTexture(target, null);
    return texture;
}

function isPowerOf2(value: number) {
    return (value & (value - 1)) == 0;
}

function isFormatCompressed(format: UncompressedTextureFormatString | CompressedTextureFormatString): format is CompressedTextureFormatString {
    return format.startsWith("COMPRESSED");
}

function getFormatInfo(gl: WebGL2RenderingContext, internalFormatString: UncompressedTextureFormatString | CompressedTextureFormatString, typeString?: Exclude<TexelTypeString, "FLOAT_32_UNSIGNED_INT_24_8_REV">) {
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
        const arrayType = getBufferViewType(type);
        return { internalFormat, format, type, arrayType };
    }
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
