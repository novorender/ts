import { GPUImageFromTextureParams, ResourceBin, type Image, type RenderContextWebGPU, RenderBuffers } from "core3d/webgpu";
import type { RenderModuleContext, RenderModule } from "../webgpu";
import { glUBOProxy, type TextureParams, type TextureParamsCubeUncompressed, type TextureParamsCubeUncompressedMipMapped, type UniformTypes } from "webgl2";
import type { DerivedRenderState } from "core3d";
import { parseKTX } from "core3d/ktx";

async function createPipeline(bin: ResourceBin, shaderModule: GPUShaderModule, buffers: RenderBuffers) {
    return await bin.createRenderPipelineAsync({
        label: "Background pipeline",
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertexMain",
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: buffers.textures.color.format,
            }],
        },
        multisample: {
            count: buffers.samples,
        }
    });
}

/** @internal */
export class BackgroundModule implements RenderModule {
    readonly kind = "background";
    private abortController: AbortController | undefined;
    url: string | undefined;
    textureParams: {
        readonly diffuse: Image;
        readonly specular: Image;
        readonly skybox: Image;
    } | undefined; // undefined means no change in textures

    readonly uniforms = {
        envBlurNormalized: "float",
        mipCount: "int",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContextWebGPU) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new BackgroundModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContextWebGPU, uniformsProxy: Uniforms) {
        const { shader } = context.imports.shadersWGSL.background.render;
        const bin = context.resourceBin("Background");
        const uniformsStaging = bin.createBuffer({
            label: "Background uniforms staging buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        });
        const uniforms = bin.createBuffer({
            label: "Background uniforms buffer",
            size: uniformsProxy.buffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const shaderModule = bin.createShaderModule({
            label: "Background shader module",
            code: shader,
        });
        const pipeline = await createPipeline(bin, shaderModule, context.buffers);

        const skybox = bin.createTexture(context.defaultIBLTextureParams);

        return { bin, uniformsStaging, uniforms, pipeline, shaderModule, skybox };
    }

    async downloadTextures(baseUrl: URL) {
        if (this.abortController) {
            this.abortController.abort();
        }
        const abortController = this.abortController = new AbortController();
        const { signal } = abortController;
        try {
            const promises = [
                download<TextureParamsCubeUncompressedMipMapped>(new URL("radiance.ktx", baseUrl)),
                download<TextureParamsCubeUncompressed>(new URL("irradiance.ktx", baseUrl)),
                download<TextureParamsCubeUncompressed>(new URL("background.ktx", baseUrl)),
            ] as const;
            const [specular, diffuse, skybox] = await Promise.all(promises);
            this.textureParams = {
                diffuse: GPUImageFromTextureParams(diffuse, GPUTextureUsage.TEXTURE_BINDING, "Diffuse"),
                specular: GPUImageFromTextureParams(specular, GPUTextureUsage.TEXTURE_BINDING, "Specular"),
                skybox: GPUImageFromTextureParams(skybox, GPUTextureUsage.TEXTURE_BINDING, "Skybox"),
            } as const;
        } finally {
            this.abortController = undefined;
        }

        async function download<T extends TextureParams>(url: URL) {
            const response = await fetch(url, { mode: "cors", signal });
            if (response.ok) {
                var ktxData = await response.arrayBuffer();
                var params = parseKTX(new Uint8Array(ktxData));
                return params as T;
            } else {
                throw new Error(`HTTP Error:${response.status} ${response.status}`);
            }
        }
    }
}

type Uniforms = ReturnType<BackgroundModule["createUniforms"]>;
type Resources = Awaited<ReturnType<BackgroundModule["createResources"]>>;

class BackgroundModuleContext implements RenderModuleContext {
    skybox: GPUTexture;
    bindGroup: GPUBindGroup;

    constructor(readonly context: RenderContextWebGPU, readonly module: BackgroundModule, readonly uniforms: Uniforms, readonly resources: Resources) {
        this.skybox = resources.skybox;
        this.bindGroup = this.createBindGroup()
    }

    createBindGroup() {
        const { context, resources, skybox } = this;
        const { bin, pipeline } = resources;
        return bin.createBindGroup({
            label: "Background bind group",
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: { buffer: context.cameraUniforms! }
                },
                {
                    binding: 1,
                    resource: { buffer: resources.uniforms },
                },
                {
                    binding: 2,
                    resource: skybox.createView({
                        dimension: "cube"
                    })
                },
                {
                    binding: 3,
                    resource: context.samplerSingle!
                },
                {
                    binding: 4,
                    resource: context.iblTextures!.specular.createView({
                        dimension: "cube"
                    })
                },
                {
                    binding: 5,
                    resource: context.samplerMip!
                }
            ]
        });
    }

    async update(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources, module, uniforms, skybox } = this;
        const { bin } = resources;
        const { background } = state;

        let texturesChanged = false;
        if (context.hasStateChanged({ background })) {
            uniforms.values.envBlurNormalized = background.blur ?? 0;
            context.updateUniformBuffer(encoder, resources.uniformsStaging, resources.uniforms, this.uniforms);
            const { url } = state.background;
            if (url) {
                if (url != module.url) {
                    await module.downloadTextures(new URL(url)).then(() => { context.changed = true; });
                }
            } else {
                context.updateIBLTextures(null);
                bin.delete(skybox);
                this.skybox = bin.createTexture(context.defaultIBLTextureParams);
                texturesChanged = true;
            }
            module.url = url;
        }

        if (module.textureParams) {
            context.updateIBLTextures(module.textureParams);
            bin.delete(skybox);
            this.skybox = bin.createTextureFromImage(module.textureParams.skybox);
            uniforms.values.mipCount = context.iblTextures!.numMipMaps;
            context.updateUniformBuffer(encoder, resources.uniformsStaging, resources.uniforms, this.uniforms);
            module.textureParams = undefined; // we already copied the pixels into texture, so we no longer need the original.
            texturesChanged = true;
        }

        if(context.buffersChanged()) {
            resources.pipeline = await createPipeline(bin, resources.shaderModule, context.buffers);
        }

        if(texturesChanged) {
            this.bindGroup = this.createBindGroup()
        }

    }

    render(encoder: GPUCommandEncoder, state: DerivedRenderState) {
        const { context, resources, bindGroup } = this;
        const { pipeline } = resources;

        const clearColor = state.background.color ?? [0.33, 0.33, 0.33, 1];

        if ((!state.background.color || state.background.url) && state.camera.kind != "orthographic") {
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.buffers.colorRenderAttachment(),
                    loadOp: "load",
                    storeOp: "store",
                }]
            });

            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup)
            pass.draw(3);
            pass.end();

            // TODO: This is not really rendering yet but probably add timers to the command buffer
            // context.addRenderStatistics(stats);
        } else {
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.buffers.colorRenderAttachment(),
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
                    // TODO: we need to explicitly resolve at the end before tonemappinng
                    // resolveTarget: context.buffers.colorResolveAttachment()
                }]
            });

            pass.end();
        }
    }

    contextLost() {
        const { module } = this;
        module.url = undefined; // force an envmap texture reload
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}
