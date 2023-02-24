import type { DerivedRenderState, RenderContext } from "@novorender/core3d";
import { KTX } from "@novorender/core3d/ktx";
import { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glClear, glProgram, glTexture, glDraw, glState, TextureParams, glBuffer, glDelete, UniformTypes, TextureParamsCubeUncompressed, TextureParamsCubeUncompressedMipMapped } from "@novorender/webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { BufferFlags } from "@novorender/core3d/buffers";

export class BackgroundModule implements RenderModule {
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
        return new BackgroundModuleContext(context, this);
    }

    // TODO: Move into worker?
    async downloadTextures(urlDir: string) {
        if (this.abortController) {
            this.abortController.abort();
        }
        const abortController = this.abortController = new AbortController();
        const { signal } = abortController;
        try {
            const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
            const baseUrl = new URL(urlDir, scriptUrl);
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
                var params = KTX.parseKTX(new Uint8Array(ktxData));
                return params as T;
            } else {
                throw new Error(`HTTP Error:${response.status} ${response.status}`);
            }
        }
    }
}

class BackgroundModuleContext implements RenderModuleContext {
    readonly uniforms;
    readonly resources;
    skybox: WebGLTexture;

    constructor(readonly context: RenderContext, readonly data: BackgroundModule) {
        const { gl, commonChunk } = context;
        this.uniforms = glUBOProxy(data.uniforms);
        const uniformBufferBlocks = ["Camera", "Background"];
        const textureUniforms = ["textures.skybox", "textures.ibl.specular"];
        const program = glProgram(gl, { vertexShader, fragmentShader, commonChunk, uniformBufferBlocks, textureUniforms });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.uniforms.buffer.byteLength });
        this.skybox = glTexture(gl, context.defaultIBLTextureParams);
        this.resources = { program, uniforms } as const;
    }

    update(state: DerivedRenderState) {
        const { context, resources, data, uniforms } = this;
        const { gl } = context;
        const { background } = state;

        if (context.hasStateChanged({ background })) {
            uniforms.values.envBlurNormalized = background.blur ?? 0;
            context.updateUniformBuffer(resources.uniforms, this.uniforms);
            const { url } = state.background;
            if (url) {
                if (url != data.url) {
                    data.downloadTextures(url).then(() => { context.changed = true; });
                }
            } else {
                context.updateIBLTextures(null);
            }
            data.url = url;
        }

        if (data.textureParams) {
            context.updateIBLTextures(data.textureParams);
            gl.deleteTexture(this.skybox);
            this.skybox = glTexture(gl, data.textureParams.skybox);
            uniforms.values.mipCount = context.iblTextures.numMipMaps;
            context.updateUniformBuffer(resources.uniforms, this.uniforms);
            data.textureParams = undefined; // we already copied the pixels into texture, so we no longer need the original.
        }
    }

    prepass() {
        glClear(this.context.gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
    }

    render(state: DerivedRenderState) {
        const { context, resources, skybox } = this;
        const { program, uniforms } = resources;
        const { gl, cameraUniforms, samplerSingle, samplerMip, drawBuffersMask } = context;

        glState(gl, {
            drawBuffers: context.drawBuffers(BufferFlags.linearDepth | BufferFlags.info),
        });
        if (!context.usePrepass) {
            glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
        }
        if (drawBuffersMask & BufferFlags.linearDepth) {
            glClear(gl, { kind: "COLOR", drawBuffer: 1, type: "Float", color: [Number.POSITIVE_INFINITY, 0, 0, 0] });
        }
        if (drawBuffersMask & BufferFlags.info) {
            glClear(gl, { kind: "COLOR", drawBuffer: 2, type: "Uint", color: [0xffffffff, 0x0000ffff, 0, 0] }); // 0xffff is bit-encoding for Float16.nan. (https://en.wikipedia.org/wiki/Half-precision_floating-point_format)
        }

        glState(gl, {
            drawBuffers: context.drawBuffers(BufferFlags.color),
        });

        if (drawBuffersMask & BufferFlags.color) {
            if (state.background.color) {
                glClear(gl, { kind: "COLOR", drawBuffer: 0, color: state.background.color });
            } else if (state.camera.kind == "orthographic") {
                glClear(gl, { kind: "COLOR", drawBuffer: 0, color: [0.33, 0.33, 0.33, 1] });
            } else {
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
                glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
            }
        }
    }

    contextLost() {
        const { data } = this;
        data.url = undefined; // force an envmap texture reload
    }

    dispose() {
        const { context, resources, skybox } = this;
        const { gl } = context;
        this.contextLost();
        glDelete(gl, resources);
        gl.deleteTexture(skybox);
    }
}
