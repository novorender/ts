import type { CubeImages, TextureImageSource, TextureParams } from "webgl2"

export type Image = {
    descriptor: GPUTextureDescriptor,
    generateMipMaps: boolean,
    data: number | BufferSource | readonly (BufferSource | null)[] | readonly (CubeImages | null)[] | TextureImageSource | null
}

export const glToGPUInternalFormat = {
    "R8": "r8unorm",
    "R8_SNORM": "r8snorm",
    "RG8": "rg8unorm",
    "RG8_SNORM": "rg8snorm",
    "RGB8": undefined,
    "RGB8_SNORM": undefined,
    "RGB565": undefined,
    "RGBA4": undefined,
    "RGB5_A1": undefined,
    "RGBA8": "rgba8unorm",
    "RGBA8_SNORM": "rgba8snorm",
    "RGB10_A2": "rgb10a2unorm",
    "RGB10_A2UI": "rgb10a2uint",
    "SRGB8": undefined,
    "SRGB8_ALPHA8": "rgba8unorm-srgb",
    "R16F": "r16float",
    "RG16F": "rg16float",
    "RGB16F": undefined,
    "RGBA16F": "rgba16float",
    "R32F": "r32float",
    "RG32F": "rg32float",
    "RGB32F": undefined,
    "RGBA32F": "rgba32float",
    "R11F_G11F_B10F": "rg11b10ufloat",
    "RGB9_E5": "rgb9e5ufloat",
    "R8I": "r8sint",
    "R8UI": "r8uint",
    "R16I": "r16sint",
    "R16UI": "r16uint",
    "R32I": "r32sint",
    "R32UI": "r32uint",
    "RG8I": "rg8sint",
    "RG8UI": "rg8uint",
    "RG16I": "rg16sint",
    "RG16UI": "rg16uint",
    "RG32I": "rg32sint",
    "RG32UI": "rg32uint",
    "RGB8I": undefined,
    "RGB8UI": undefined,
    "RGB16I": undefined,
    "RGB16UI": undefined,
    "RGB32I": undefined,
    "RGB32UI": undefined,
    "RGBA8I": "rgba8sint",
    "RGBA8UI": "rgba8uint",
    "RGBA16I": "rgba16sint",
    "RGBA16UI": "rgba16uint",
    "RGBA32I": "rgba32sint",
    "RGBA32UI": "rgba32uint",
    "DEPTH_COMPONENT16": "depth16unorm",
    "DEPTH_COMPONENT24": "depth24plus",
    "DEPTH_COMPONENT32F": "depth32float",
    "DEPTH24_STENCIL8": "depth24plus-stencil8",
    "DEPTH32F_STENCIL8": "depth32float-stencil8",
    // WEBGL_compressed_texture_s3tc
    "COMPRESSED_RGB_S3TC_DXT1_EXT": undefined, // TODO: is this correct
    "COMPRESSED_RGBA_S3TC_DXT1_EXT": "bc1-rgba-unorm",
    "COMPRESSED_RGBA_S3TC_DXT3_EXT": "bc2-rgba-unorm",
    "COMPRESSED_RGBA_S3TC_DXT5_EXT": "bc3-rgba-unorm",

    // WEBGL_compressed_texture_s3tc_srgb
    "COMPRESSED_SRGB_S3TC_DXT1_EXT": undefined,
    "COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT": "bc1-rgba-unorm-srgb",
    "COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT": "bc2-rgba-unorm-srgb",
    "COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT": "bc3-rgba-unorm-srgb",

    // WEBGL_compressed_texture_etc
    "COMPRESSED_R11_EAC": "eac-r11unorm",
    "COMPRESSED_SIGNED_R11_EAC": "eac-r11snorm",
    "COMPRESSED_RG11_EAC": "eac-rg11unorm",
    "COMPRESSED_SIGNED_RG11_EAC": "eac-rg11snorm",
    "COMPRESSED_RGB8_ETC2": "etc2-rgb8unorm",
    "COMPRESSED_RGBA8_ETC2_EAC": "etc2-rgba8unorm",
    "COMPRESSED_SRGB8_ETC2": "etc2-rgb8unorm-srgb",
    "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC": "etc2-rgba8unorm-srgb",
    "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2": "etc2-rgb8a1unorm",
    "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2": "etc2-rgb8a1unorm-srgb",

    // WEBGL_compressed_texture_pvrtc
    "COMPRESSED_RGB_PVRTC_4BPPV1_IMG": undefined,
    "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG": undefined,
    "COMPRESSED_RGB_PVRTC_2BPPV1_IMG": undefined,
    "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG": undefined,

    // WEBGL_compressed_texture_etc1
    "COMPRESSED_RGB_ETC1_WEBGL": "etc2-rgb8unorm", // Doesn't really exist in webgpu but backwards compatible?
                                                      // https://en.wikipedia.org/wiki/Ericsson_Texture_Compression
    // WEBGL_compressed_texture_astc
    "COMPRESSED_RGBA_ASTC_4x4_KHR": "astc-4x4-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR": "astc-4x4-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_5x4_KHR": "astc-5x4-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR": "astc-5x4-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_5x5_KHR": "astc-5x5-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR": "astc-5x5-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_6x5_KHR": "astc-6x5-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR": "astc-6x5-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_6x6_KHR": "astc-6x6-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR": "astc-6x6-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_8x5_KHR": "astc-8x5-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR": "astc-8x5-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_8x6_KHR": "astc-8x6-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR": "astc-8x6-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_8x8_KHR": "astc-8x8-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR": "astc-8x8-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_10x5_KHR": "astc-10x5-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR": "astc-10x5-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_10x6_KHR": "astc-10x6-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR": "astc-10x6-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_10x10_KHR": "astc-10x10-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR": "astc-10x10-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_12x10_KHR": "astc-12x10-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR": "astc-12x10-unorm-srgb",
    "COMPRESSED_RGBA_ASTC_12x12_KHR": "astc-12x12-unorm",
    "COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR": "astc-12x12-unorm-srgb",

    // EXT_texture_compression_bptc
    "COMPRESSED_RGBA_BPTC_UNORM_EXT": "bc7-rgba-unorm",
    "COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT": "bc7-rgba-unorm-srgb",
    "COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT": "bc6h-rgb-float",
    "COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT": "bc6h-rgb-ufloat",

    // EXT_texture_compression_rgtc
    "COMPRESSED_RED_RGTC1_EXT": "bc4-r-unorm",
    "COMPRESSED_SIGNED_RED_RGTC1_EXT": "bc4-r-snorm",
    "COMPRESSED_RED_GREEN_RGTC2_EXT": "bc5-rg-unorm",
    "COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT": "bc5-rg-snorm",
} as const;

export function dimensionFromTextureParams(textureParams: TextureParams) : GPUTextureDimension {
    switch (textureParams.kind) {
        case "TEXTURE_2D": return "2d";
        case "TEXTURE_3D": return "3d";
        case "TEXTURE_2D_ARRAY": return "2d";
        case "TEXTURE_CUBE_MAP": return "2d";
    }
}

export function depthOrArrayLayersFromTextureParams(textureParams: TextureParams) : number | undefined {
    switch (textureParams.kind) {
        case "TEXTURE_2D": return undefined;
        case "TEXTURE_CUBE_MAP": return 6;
        case "TEXTURE_3D": return textureParams.depth;
        case "TEXTURE_2D_ARRAY": textureParams.depth;
    }
}

export function GPUImageFromTextureParams(textureParams: TextureParams, usage: number, label?: string) : Image {
    const internalFormat = glToGPUInternalFormat[textureParams.internalFormat];
    if (!internalFormat) {
        throw "Unsupported texture format"
    }
    return {
        descriptor: {
            size: {
                width: textureParams.width!,
                height: textureParams.height,
                depthOrArrayLayers: depthOrArrayLayersFromTextureParams(textureParams)
            },
            format: internalFormat,
            dimension: dimensionFromTextureParams(textureParams),
            usage,
            label,
            mipLevelCount: "mipMaps" in textureParams ? typeof(textureParams.mipMaps) == "number" ? textureParams.mipMaps : textureParams.mipMaps.length : undefined,
        },
        generateMipMaps: ("generateMipMaps" in textureParams && textureParams.generateMipMaps) ?? false,
        data: "image" in textureParams ? textureParams.image : textureParams.mipMaps
    };
}

export const generateMipmapsBlockDim = 16;
export function generateMipmaps(device: GPUDevice, mipmapsPipeline: GPUComputePipeline, texture: GPUTexture) {
    const maxSide = Math.max(texture.width, texture.height);
    const mipLevelCount = Math.floor(Math.log2(maxSide)) + 1;
    const output = device.createTexture({
        label: "Mipmap generation output",
        dimension: texture.dimension,
        size: { width: texture.width, height: texture.height },
        mipLevelCount,
        sampleCount: 1,
        format: texture.format,
        usage: GPUTextureUsage.STORAGE_BINDING
            | GPUTextureUsage.TEXTURE_BINDING
            | GPUTextureUsage.COPY_SRC
            | GPUTextureUsage.COPY_DST
    });

    const encoder = device.createCommandEncoder();

    encoder.copyTextureToTexture({texture}, {texture: output}, {width: texture.width, height: texture.height});

    let side = maxSide >> 1;
    let width = Math.max(texture.width >> 1, 1);
    let height = Math.max(texture.height >> 1, 1);
    let level = 0;
    while (side > 0) {
        const outputView = output.createView({
            dimension: "2d",
            baseMipLevel: level + 1,
            mipLevelCount: 1,
        });
        let inputView = output.createView({
            dimension: "2d",
            baseMipLevel: level,
            mipLevelCount: 1,
        });

        let bindGroupLayout = mipmapsPipeline.getBindGroupLayout(0);
        let bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: inputView,
                },
                {
                    binding: 1,
                    resource: outputView
                }
            ]
        });

        const cpass = encoder.beginComputePass();
        cpass.setPipeline(mipmapsPipeline);
        cpass.setBindGroup(0, bindGroup);
        cpass.dispatchWorkgroups(Math.ceil(width / generateMipmapsBlockDim), Math.ceil(height / generateMipmapsBlockDim));
        cpass.end();

        width = Math.max(width >> 1, 1);
        height = Math.max(height >> 1, 1);
        side = side >> 1;
        level += 1;
    }

    device.queue.submit([encoder.finish()]);

    return output;
}