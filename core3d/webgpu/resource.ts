type GPUResource = GPUTexture | GPUBuffer | GPUShaderModule | GPUSampler | GPURenderPipeline | GPUComputePipeline | GPUBindGroup;

/**
 * A WebGL resource tracking helper class.
 * @remarks
 * Resource bins are used to track allocation of WebGL resources and assist with automatic disposal.
 * @category Render Module
 */
export class ResourceBin {
    private readonly resourceMap = new Map<GPUResource, ResourceInfo[]>();

    /** @internal */
    constructor(
        readonly device: GPUDevice,
        /** The name of the resource bin. */
        readonly name: string,
        private readonly collection: Set<ResourceBin>) {
        this.collection.add(this);
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

    createBuffer(params: GPUBufferDescriptor) {
        return this.add(this.device.createBuffer(params), { kind: "Buffer", byteSize: params.size });
    }

    createShaderModule(params: GPUShaderModuleDescriptor) {
        return this.add(this.device.createShaderModule(params), { kind: "ShaderModule" });
    }

    createSampler(params: GPUSamplerDescriptor | undefined) {
        return this.add(this.device.createSampler(params), { kind: "Sampler" });
    }

    createTexture(params: GPUTextureDescriptor) {
        return this.add(this.device.createTexture(params), { kind: "Texture", byteSize: textureBytes(params) });
    }

    createRenderPipeline(params: GPURenderPipelineDescriptor) {
        return this.add(this.device.createRenderPipeline(params), { kind: "RenderPipeline" })
    }

    async createRenderPipelineAsync(params: GPURenderPipelineDescriptor) {
        return this.add(await this.device.createRenderPipelineAsync(params), { kind: "RenderPipeline" })
    }

    createComputePipeline(params: GPUComputePipelineDescriptor) {
        return this.add(this.device.createComputePipeline(params), { kind: "ComputePipeline" })
    }

    createBindGroup(params: GPUBindGroupDescriptor) {
        return this.add(this.device.createBindGroup(params), { kind: "BindGroup" })
    }

    private add<T extends GPUResource>(resource: T, info: ResourceInfo): T {
        console.assert(resource.constructor.name.startsWith("GPU"));
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
    // TODO: no VAOs on WebGPU
    // subordinate(owner: WebGLVertexArrayObject | WebGLFramebuffer, ...resources: readonly (WebGLResource | null)[]) {
    //     const deletedInfos: ResourceInfo[] = [];
    //     console.assert(resources.length > 0);
    //     this.del(resources, deletedInfos);
    //     const ownerInfos = this.resourceMap.get(owner);
    //     if (ownerInfos) {
    //         ownerInfos.push(...deletedInfos);
    //     }
    // }

    delete(...resources: readonly (GPUResource | null)[]) {
        this.del(resources);
    }

    private del(resources: readonly (GPUResource | null)[], deleteInfos?: ResourceInfo[]) {
        const { device, resourceMap } = this;
        for (const resource of resources) {
            if (!resource)
                continue;
            const infos = this.resourceMap.get(resource);
            if (infos && infos.length > 0) {
                for (const info of infos) {
                    deleteInfos?.push(info);
                }
                const [primary] = infos;
                if("destroy" in resource) {
                    resource.destroy();
                }
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
        if (this.device) {
            this.deleteAll();
            this.collection.delete(this);
        }
    }
}

function textureBytes(params: GPUTextureDescriptor) {
    let width, height, depthOrArrayLayers;
    if("width" in params.size) {
        width = params.size.width;
        height = params.size.height ?? 1;
        depthOrArrayLayers = params.size.depthOrArrayLayers ?? 1;
    }else{
        const [w, h, d] = params.size as any;
        width = w;
        height = h ?? 1;
        depthOrArrayLayers = d ?? 1;
    }
    const topLeveltexels = width * height * depthOrArrayLayers;
    let totalTexels = 0;

    const levels = params.mipLevelCount ?? 1;

    // TODO
    // if ("generateMipMaps" in params && params.generateMipMaps && isPowerOf2(width) && isPowerOf2(height)) {
    //     levels = Math.min(Math.log2(width), Math.log2(height));
    // }
    for (let level = 0; level < levels; level++) {
        totalTexels += topLeveltexels >> level;
    }
    const bytesPerTexel = Math.ceil(internalFormatTexelBytes[params.format]);
    return Math.ceil(totalTexels * bytesPerTexel);
}

// only makes sense if entire buffers are use exclusively for this vao.
// function vaoReferencedByteSize(gl: WebGL2RenderingContext, params: VertexArrayParams) {
//     const buffers = new Set<WebGLBuffer>();
//     for (const attrib of params.attributes) {
//         const buffer = attrib?.buffer;
//         if (buffer) {
//             buffers.add(buffer);
//         }
//     }
//     let byteSize = 0;
//     for (const buffer of buffers) {
//         gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
//         byteSize += gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE);
//     };
//     gl.bindBuffer(gl.ARRAY_BUFFER, null);
//     if (params.indices) {
//         gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.indices);
//         byteSize += gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER, gl.BUFFER_SIZE);
//         gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
//     }
//     return byteSize;
// }

function isPowerOf2(value: number) {
    return (value & (value - 1)) == 0;
}

const resourceKinds = [
    "Buffer",
    "ShaderModule",
    "Query",
    "Sampler",
    "Shader",
    "Sync",
    "Texture",
    "RenderPipeline",
    "ComputePipeline",
    "BindGroup",
] as const;

const internalFormatTexelBytes = {
    // 8-bit formats
    "r8unorm": 1,
    "r8snorm": 1,
    "r8uint": 1,
    "r8sint": 1,

    // 16-bit formats
    "r16uint": 2,
    "r16sint": 2,
    "r16float": 2,
    "rg8unorm": 2,
    "rg8snorm": 2,
    "rg8uint": 2,
    "rg8sint": 2,

    // 32-bit formats
    "r32uint": 4,
    "r32sint": 4,
    "r32float": 4,
    "rg16uint": 4,
    "rg16sint": 4,
    "rg16float": 4,
    "rgba8unorm": 4,
    "rgba8unorm-srgb": 4,
    "rgba8snorm": 4,
    "rgba8uint": 4,
    "rgba8sint": 4,
    "bgra8unorm": 4,
    "bgra8unorm-srgb": 4,
    // Packed 32-bit formats
    "rgb9e5ufloat": 4,
    "rgb10a2uint": 4,
    "rgb10a2unorm": 4,
    "rg11b10ufloat": 4,

    // 64-bit formats
    "rg32uint": 8,
    "rg32sint": 8,
    "rg32float": 8,
    "rgba16uint": 8,
    "rgba16sint": 8,
    "rgba16float": 8,

    // 128-bit formats
    "rgba32uint": 16,
    "rgba32sint": 16,
    "rgba32float": 16,

    // Depth/stencil formats
    "stencil8": 1,
    "depth16unorm": 2,
    "depth24plus": 3, //undefined,
    "depth24plus-stencil8": 4, //{all: undefined, "depth-only": undefined, "stencil-only": 1},
    "depth32float": 4,

    // "depth32float-stencil8" feature
    "depth32float-stencil8": 5, //{all: undefined, "depth-only": 4, "stencil-only": 1},

    // BC compressed formats usable if "texture-compression-bc" is both
    // supported by the device/user agent and enabled in requestDevice.
    "bc1-rgba-unorm": 8 / (4*4),
    "bc1-rgba-unorm-srgb": 8 / (4*4),
    "bc2-rgba-unorm": 16 / (4*4),
    "bc2-rgba-unorm-srgb": 16 / (4*4),
    "bc3-rgba-unorm": 16 / (4*4),
    "bc3-rgba-unorm-srgb": 16 / (4*4),
    "bc4-r-unorm": 8 / (4*4),
    "bc4-r-snorm": 8 / (4*4),
    "bc5-rg-unorm": 16 / (4*4),
    "bc5-rg-snorm": 16 / (4*4),
    "bc6h-rgb-ufloat": 16 / (4*4),
    "bc6h-rgb-float": 16 / (4*4),
    "bc7-rgba-unorm": 16 / (4*4),
    "bc7-rgba-unorm-srgb": 16 / (4*4),

    // ETC2 compressed formats usable if "texture-compression-etc2" is both
    // supported by the device/user agent and enabled in requestDevice.
    "etc2-rgb8unorm": 8 / (4*4),
    "etc2-rgb8unorm-srgb": 8 / (4*4),
    "etc2-rgb8a1unorm": 8 / (4*4),
    "etc2-rgb8a1unorm-srgb": 8 / (4*4),
    "etc2-rgba8unorm": 16 / (4*4),
    "etc2-rgba8unorm-srgb": 16 / (4*4),
    "eac-r11unorm": 8 / (4*4),
    "eac-r11snorm": 8 / (4*4),
    "eac-rg11unorm": 16 / (4*4),
    "eac-rg11snorm": 16 / (4*4),

    // ASTC compressed formats usable if "texture-compression-astc" is both
    // supported by the device/user agent and enabled in requestDevice.
    "astc-4x4-unorm": 16 / (4*4),
    "astc-4x4-unorm-srgb": 16 / (4*4),
    "astc-5x4-unorm": 16 / (5*4),
    "astc-5x4-unorm-srgb": 16 / (5*4),
    "astc-5x5-unorm": 16 / (5*5),
    "astc-5x5-unorm-srgb": 16 / (5*5),
    "astc-6x5-unorm": 16 / (6*5),
    "astc-6x5-unorm-srgb": 16 / (6*5),
    "astc-6x6-unorm": 16 / (6*6),
    "astc-6x6-unorm-srgb": 16 / (6*6),
    "astc-8x5-unorm": 16 / (8*5),
    "astc-8x5-unorm-srgb": 16 / (8*5),
    "astc-8x6-unorm": 16 / (8*6),
    "astc-8x6-unorm-srgb": 16 / (8*6),
    "astc-8x8-unorm": 16 / (8*8),
    "astc-8x8-unorm-srgb": 16 / (8*8),
    "astc-10x5-unorm": 16 / (10*5),
    "astc-10x5-unorm-srgb": 16 / (10*5),
    "astc-10x6-unorm": 16 / (10*6),
    "astc-10x6-unorm-srgb": 16 / (10*6),
    "astc-10x8-unorm": 16 / (10*8),
    "astc-10x8-unorm-srgb": 16 / (10*8),
    "astc-10x10-unorm": 16 / (10*10),
    "astc-10x10-unorm-srgb": 16 / (10*10),
    "astc-12x10-unorm": 16 / (12*10),
    "astc-12x10-unorm-srgb": 16 / (12*10),
    "astc-12x12-unorm": 16 / (12*12),
    "astc-12x12-unorm-srgb": 16 / (12*12),
} as const;

export type ResourceKind = typeof resourceKinds[number];

export interface ResourceInfo {
    readonly kind: ResourceKind;
    readonly byteSize?: number;
    readonly tag?: string;
}