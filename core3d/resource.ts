import { glCreateBuffer, glCreateFrameBuffer, glCreateProgram, glCreateRenderbuffer, glCreateSampler, glCreateTexture, glCreateVertexArray, type WebGLResource, type BufferParams, type BufferTargetString, type FrameBufferParams, type ProgramParams, type RenderbufferParams, type SamplerParams, type TextureParams, type TextureTargetString, type VertexArrayParams } from "@novorender/webgl2";

export class ResourceBin {
    private readonly resourceMap = new Map<WebGLResource, ResourceInfo[]>();

    private constructor(readonly gl: WebGL2RenderingContext, readonly name: string, private readonly collection: Set<ResourceBin>) {
        this.collection.add(this);
    }

    protected static create(gl: WebGL2RenderingContext, name: string, collection: Set<ResourceBin>) {
        return new ResourceBin(gl, name, collection);
    }

    get resourceInfo(): IterableIterator<ResourceInfo> {
        const { resourceMap } = this;
        function* iterate() {
            for (const infos of resourceMap.values()) {
                for (const info of infos) {
                    yield { ...info } as const satisfies ResourceInfo;
                }
            }
        }
        return iterate();
    }

    get size() {
        return this.resourceMap.size;
    }

    createBuffer(params: BufferParams) {
        return this.add(glCreateBuffer(this.gl, params), { kind: "Buffer", target: params.kind, byteSize: bufferBytes(params) });
    }

    createFrameBuffer(params: FrameBufferParams) {
        return this.add(glCreateFrameBuffer(this.gl, params), { kind: "Framebuffer" });
    }

    createProgram(params: ProgramParams) {
        return this.add(glCreateProgram(this.gl, params), { kind: "Program" });
    }

    createRenderBuffer(params: RenderbufferParams) {
        return this.add(glCreateRenderbuffer(this.gl, params), { kind: "Renderbuffer" });
    }

    createSampler(params: SamplerParams) {
        return this.add(glCreateSampler(this.gl, params), { kind: "Sampler" });
    }

    createTexture(params: TextureParams) {
        return this.add(glCreateTexture(this.gl, params), { kind: "Texture", target: params.kind, byteSize: textureBytes(params) });
    }

    createTransformFeedback() {
        return this.add(this.gl.createTransformFeedback()!, { kind: "TransformFeedback" });
    }

    createVertexArray(params: VertexArrayParams): WebGLVertexArrayObject {
        return this.add(glCreateVertexArray(this.gl, params), { kind: "VertexArray" });
    }

    private add<T extends WebGLResource>(resource: T, info: ResourceInfo): T {
        if (!this.resourceMap.has(resource)) {
            this.resourceMap.set(resource, [info]);
        } else {
            throw new Error("Resource added more than once!");
        }
        return resource;
    }

    // delete resources that are already kept alive/referenced by other resources,
    // e.g. a buffer referenced by a vertex array object or a texture referenced by a framebuffer.
    // this will remove them from the list of attached resources but retain info for resource tracking purposes
    subordinate(owner: WebGLVertexArrayObject | WebGLFramebuffer, ...resources: readonly (WebGLResource | null)[]) {
        const deletedInfos: ResourceInfo[] = [];
        console.assert(resources.length > 0);
        this.del(resources, deletedInfos);
        const ownerInfos = this.resourceMap.get(owner);
        if (ownerInfos) {
            ownerInfos.push(...deletedInfos);
        }
    }

    delete(...resources: readonly (WebGLResource | null)[]) {
        this.del(resources);
    }

    private del(resources: readonly (WebGLResource | null)[], deleteInfos?: ResourceInfo[]) {
        const { gl, resourceMap } = this;
        for (const resource of resources) {
            if (!resource)
                continue;
            const infos = this.resourceMap.get(resource);
            if (infos && infos.length > 0) {
                for (const info of infos) {
                    deleteInfos?.push(info);
                }
                const [primary] = infos;
                gl[`delete${primary.kind}`](resource);
                resourceMap.delete(resource);
            } else {
                throw new Error("Resource could not be found!"); // removed twice or never added in the first place?
            }
        }
    }

    deleteAll() {
        this.delete(...this.resourceMap.keys());
        this.resourceMap.clear(); // remove any detached entries
    }

    dispose() {
        if (this.gl) {
            this.deleteAll();
            this.collection.delete(this);
        }
    }
}

function bufferBytes(params: BufferParams) {
    return "byteSize" in params ? params.byteSize : params.srcData.byteLength;
}

function textureBytes(params: TextureParams) {
    const width = params.width ?? params.image.width;
    const height = params.height ?? params.image.height;
    const depth = "depth" in params ? params.depth : 1;
    const faces = params.kind == "TEXTURE_CUBE_MAP" ? 6 : 1;
    const topLeveltexels = width * height * depth * faces;
    let totalTexels = 0;
    let levels = 1;
    if ("mipMaps" in params) {
        const { mipMaps } = params;
        const isNumber = typeof mipMaps == "number";
        levels = isNumber ? mipMaps : mipMaps.length;
    }
    if ("generateMipMaps" in params && params.generateMipMaps && isPowerOf2(width) && isPowerOf2(height)) {
        levels = Math.min(Math.log2(width), Math.log2(height));
    }
    for (let level = 0; level < levels; level++) {
        totalTexels += topLeveltexels >> level;
    }
    const bytesPerTexel = Math.ceil(internalFormatTexelBytes[params.internalFormat]);
    return Math.ceil(totalTexels * bytesPerTexel);
}

// only makes sense if entire buffers are use exclusively for this vao.
function vaoReferencedByteSize(gl: WebGL2RenderingContext, params: VertexArrayParams) {
    const buffers = new Set<WebGLBuffer>();
    for (const attrib of params.attributes) {
        const buffer = attrib?.buffer;
        if (buffer) {
            buffers.add(buffer);
        }
    }
    let byteSize = 0;
    for (const buffer of buffers) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        byteSize += gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    if (params.indices) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.indices);
        byteSize += gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER, gl.BUFFER_SIZE);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }
    return byteSize;
}

function isPowerOf2(value: number) {
    return (value & (value - 1)) == 0;
}

const resourceKinds = [
    "Buffer",
    "Framebuffer",
    "Program",
    "Query",
    "Renderbuffer",
    "Sampler",
    "Shader",
    "Sync",
    "TransformFeedback",
    "Texture",
    "VertexArray",
] as const;

const internalFormatTexelBytes = {
    "RGB": 3,
    "RGBA": 4,
    "LUMINANCE_ALPHA": 2,
    "LUMINANCE": 1,
    "ALPHA": 1,
    "R8": 1,
    "R8_SNORM": 1,
    "RG8": 2,
    "RG8_SNORM": 2,
    "RGB8": 3,
    "RGB8_SNORM": 3,
    "RGB565": 2,
    "RGBA4": 2,
    "RGB5_A1": 2,
    "RGBA8": 4,
    "RGBA8_SNORM": 4,
    "RGB10_A2": 4,
    "RGB10_A2UI": 4,
    "SRGB8": 3,
    "SRGB8_ALPHA8": 4,
    "R16F": 2,
    "RG16F": 4,
    "RGB16F": 6,
    "RGBA16F": 8,
    "R32F": 4,
    "RG32F": 8,
    "RGB32F": 16,
    "RGBA32F": 32,
    "R11F_G11F_B10F": 4,
    "RGB9_E5": 4,
    "R8I": 1,
    "R8UI": 1,
    "R16I": 2,
    "R16UI": 2,
    "R32I": 4,
    "R32UI": 4,
    "RG8I": 2,
    "RG8UI": 2,
    "RG16I": 4,
    "RG16UI": 4,
    "RG32I": 8,
    "RG32UI": 8,
    "RGB8I": 3,
    "RGB8UI": 4,
    "RGB16I": 6,
    "RGB16UI": 6,
    "RGB32I": 12,
    "RGB32UI": 12,
    "RGBA8I": 4,
    "RGBA8UI": 4,
    "RGBA16I": 8,
    "RGBA16UI": 8,
    "RGBA32I": 16,
    "RGBA32UI": 16,
    "DEPTH_COMPONENT16": 2,
    "DEPTH_COMPONENT24": 3,
    "DEPTH_COMPONENT32F": 4,
    "DEPTH24_STENCIL8": 4,
    "DEPTH32F_STENCIL8": 5,
    // WEBGL_compressed_texture_s3tc
    "COMPRESSED_RGB_S3TC_DXT1_EXT": .5,
    "COMPRESSED_RGBA_S3TC_DXT1_EXT": .5,
    "COMPRESSED_RGBA_S3TC_DXT3_EXT": 1,
    "COMPRESSED_RGBA_S3TC_DXT5_EXT": 1,
    // WEBGL_compressed_texture_s3tc_srgb
    "COMPRESSED_SRGB_S3TC_DXT1_EXT": .5,
    "COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT": .5,
    "COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT": 1,
    "COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT": 1,
    // WEBGL_compressed_texture_etc
    "COMPRESSED_R11_EAC": .5,
    "COMPRESSED_SIGNED_R11_EAC": .5,
    "COMPRESSED_RG11_EAC": 1,
    "COMPRESSED_SIGNED_RG11_EAC": 1,
    "COMPRESSED_RGB8_ETC2": .5,
    "COMPRESSED_RGBA8_ETC2_EAC": 1,
    "COMPRESSED_SRGB8_ETC2": .5,
    "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC": 1,
    "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2": .5,
    "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2": .5,
    // WEBGL_compressed_texture_pvrtc
    "COMPRESSED_RGB_PVRTC_4BPPV1_IMG": .5,
    "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG": .5,
    "COMPRESSED_RGB_PVRTC_2BPPV1_IMG": .25,
    "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG": .25,
    // WEBGL_compressed_texture_etc1    
    "COMPRESSED_RGB_ETC1_WEBGL": .5,
    // WEBGL_compressed_texture_astc    
    "COMPRESSED_RGBA_ASTC_4x4_KHR": 16 / (4 * 4),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR": 16 / (4 * 4),
    "COMPRESSED_RGBA_ASTC_5x4_KHR": 16 / (5 * 4),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR": 16 / (5 * 4),
    "COMPRESSED_RGBA_ASTC_5x5_KHR": 16 / (5 * 5),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR": 16 / (5 * 5),
    "COMPRESSED_RGBA_ASTC_6x5_KHR": 16 / (6 * 5),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR": 16 / (6 * 5),
    "COMPRESSED_RGBA_ASTC_6x6_KHR": 16 / (6 * 6),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR": 16 / (6 * 6),
    "COMPRESSED_RGBA_ASTC_8x5_KHR": 16 / (8 * 5),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR": 16 / (8 * 5),
    "COMPRESSED_RGBA_ASTC_8x6_KHR": 16 / (8 * 6),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR": 16 / (8 * 6),
    "COMPRESSED_RGBA_ASTC_8x8_KHR": 16 / (8 * 8),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR": 16 / (8 * 8),
    "COMPRESSED_RGBA_ASTC_10x5_KHR": 16 / (10 * 5),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR": 16 / (10 * 5),
    "COMPRESSED_RGBA_ASTC_10x6_KHR": 16 / (10 * 6),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR": 16 / (10 * 6),
    "COMPRESSED_RGBA_ASTC_10x10_KHR": 16 / (10 * 10),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR": 16 / (10 * 10),
    "COMPRESSED_RGBA_ASTC_12x10_KHR": 16 / (12 * 10),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR": 16 / (12 * 10),
    "COMPRESSED_RGBA_ASTC_12x12_KHR": 16 / (12 * 12),
    "COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR": 16 / (12 * 12),
    // EXT_texture_compression_bptc    
    "COMPRESSED_RGBA_BPTC_UNORM_EXT": 1,
    "COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT": 1,
    "COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT": 1,
    "COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT": 1,
    // EXT_texture_compression_rgtc    
    "COMPRESSED_RED_RGTC1_EXT": .5,
    "COMPRESSED_SIGNED_RED_RGTC1_EXT": .5,
    "COMPRESSED_RED_GREEN_RGTC2_EXT": 1,
    "COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT": 1,
} as const;

export type ResourceKind = typeof resourceKinds[number];
export type ResourceTarget = BufferTargetString | TextureTargetString | "FRAMEBUFFER";

export interface ResourceInfo {
    readonly kind: ResourceKind;
    readonly target?: ResourceTarget;
    readonly byteSize?: number;
    readonly tag?: string;
}