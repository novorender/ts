import type { DerivedRenderState, RenderContext } from "core3d";
import { parseKTX } from "core3d/ktx";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glClear, glDraw, glState } from "webgl2";
import { type TextureParams, type UniformTypes, type TextureParamsCubeUncompressed, type TextureParamsCubeUncompressedMipMapped } from "webgl2";
import { BufferFlags } from "core3d/buffers";

/** @internal */
export class BackgroundModule implements RenderModule {
    readonly kind = "background";
    private abortController: AbortController | undefined;
    url: string | undefined;
    textureParams: {
        readonly diffuse: TextureParamsCubeUncompressed;
        readonly specular: TextureParamsCubeUncompressedMipMapped;
        readonly skybox: TextureParamsCubeUncompressed;
    } | undefined; // undefined means no change in textures

    readonly uniforms = {
        envBlurNormalized: "float",
        mipCount: "int",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new BackgroundModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const { vertexShader, fragmentShader } = context.imports.shaders.background.render;
        const bin = context.resourceBin("Background");
        const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.buffer.byteLength });
        const uniformBufferBlocks = ["Camera", "Background"];
        const textureUniforms = ["textures.skybox", "textures.ibl.specular"];
        const program = await context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks, textureUniforms });
        return { bin, uniforms, program } as const;
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
            this.textureParams = { diffuse, specular, skybox } as const;
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
    skybox: WebGLTexture;

    constructor(readonly context: RenderContext, readonly module: BackgroundModule, readonly uniforms: Uniforms, readonly resources: Resources) {
        this.skybox = resources.bin.createTexture(context.defaultIBLTextureParams);
    }

    update(state: DerivedRenderState) {
        const { context, resources, module, uniforms, skybox } = this;
        const { bin } = resources;
        const { background } = state;

        if (context.hasStateChanged({ background })) {
            uniforms.values.envBlurNormalized = background.blur ?? 0;
            context.updateUniformBuffer(resources.uniforms, this.uniforms);
            const { url } = state.background;
            if (url) {
                if (url != module.url) {
                    module.downloadTextures(new URL(url)).then(() => { context.changed = true; });
                }
            } else {
                context.updateIBLTextures(null);
                bin.delete(skybox);
                this.skybox = bin.createTexture(context.defaultIBLTextureParams);
            }
            module.url = url;
        }

        if (module.textureParams) {
            context.updateIBLTextures(module.textureParams);
            bin.delete(skybox);
            this.skybox = bin.createTexture(module.textureParams.skybox);
            uniforms.values.mipCount = context.iblTextures.numMipMaps;
            context.updateUniformBuffer(resources.uniforms, this.uniforms);
            module.textureParams = undefined; // we already copied the pixels into texture, so we no longer need the original.
        }
    }

    render(state: DerivedRenderState) {
        const { context, resources, skybox } = this;
        const { program, uniforms } = resources;
        const { gl, cameraUniforms, samplerSingle, samplerMip } = context;

        const clearColor =
            (state.background.color ?
                [state.background.color[0], state.background.color[1], state.background.color[2], 1] :
                [0.33, 0.33, 0.33, 1]) as [number, number, number, number];

        if ((!state.background.color || state.background.url) && state.camera.kind != "orthographic") {
            const { specular } = context.iblTextures;
            glState(gl, {
                program,
                uniformBuffers: [cameraUniforms, uniforms],
                textures: [
                    { kind: "TEXTURE_CUBE_MAP", texture: skybox, sampler: samplerSingle },
                    { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip },
                ],
                depth: {
                    test: false,
                    writeMask: false,
                },
            });
            const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
            context.addRenderStatistics(stats);
        } else {
            glClear(gl, { kind: "COLOR", drawBuffer: 0, color: clearColor });
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
