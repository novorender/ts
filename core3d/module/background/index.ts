import type { DerivedRenderState, RenderContext } from "core3d";
import { KTX } from "core3d/ktx";
import { RenderModuleContext, RenderModule } from "..";
import { createUniformsProxy, glClear, glProgram, glSampler, glTexture, glDraw, glUniformLocations, glState, TextureParams, glBuffer, glDelete, TextureParams2DUncompressedMipMapped, UniformTypes } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class BackgroundModule implements RenderModule {
    private abortController: AbortController | undefined;
    url: string | undefined;
    textureParams: {
        readonly lut_ggx: TextureParams;
        readonly diffuse: TextureParams;
        readonly specular: TextureParams;
        readonly skybox: TextureParams;
    } | null | undefined = null; // null means no textures, whereas undefined means no change in textures
    numMipMaps = 0;

    readonly uniforms = {
        envBlurNormalized: "float",
        mipCount: "int",
    } as const satisfies Record<string, UniformTypes>;

    withContext(context: RenderContext) {
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
                download(new URL("../lut_ggx.ktx", baseUrl)),
                download(new URL("radiance.ktx", baseUrl)),
                download(new URL("irradiance.ktx", baseUrl)),
                download(new URL("background.ktx", baseUrl)),
            ];
            const [lut_ggx, diffuse, specular, skybox] = await Promise.all(promises);
            this.textureParams = { lut_ggx, specular, diffuse, skybox } as const;
            const { mipMaps } = diffuse as TextureParams2DUncompressedMipMapped;
            this.numMipMaps = typeof mipMaps == "number" ? mipMaps : mipMaps.length;
        } finally {
            this.abortController = undefined;
        }

        async function download(url: URL) {
            const response = await fetch(url, { mode: "cors", signal });
            if (response.ok) {
                var ktxData = await response.arrayBuffer();
                var params = KTX.parseKTX(new Uint8Array(ktxData));
                return params;
            } else {
                throw new Error(`HTTP Error:${response.status} ${response.status}`);
            }
        }
    }
}

class BackgroundModuleContext implements RenderModuleContext {
    readonly uniforms;
    readonly textureUniformLocations;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: BackgroundModule) {
        const { gl } = context;
        this.uniforms = createUniformsProxy(data.uniforms);
        const uniformBufferBlocks = ["Camera", "Background"];
        const program = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks });
        const samplerSingle = glSampler(gl, { minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const samplerMip = glSampler(gl, { minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: this.uniforms.buffer.byteLength });
        this.resources = { program, samplerSingle, samplerMip, uniforms } as const;
        this.textureUniformLocations = glUniformLocations(gl, program, ["skybox", "diffuse"] as const, "textures_");
    }

    updateUniforms(state: DerivedRenderState) {
        const { background } = state;
        const { values } = this.uniforms;
        values.envBlurNormalized = background.blur ?? 0;
        values.mipCount = this.data.numMipMaps; // 9
    }

    update(state: DerivedRenderState) {
        const { context, resources, data } = this;
        const { gl } = context;
        const { textureParams } = data;
        const { background } = state;

        if (textureParams !== undefined) {
            if (textureParams !== null) {
                const { lut_ggx, diffuse, specular, skybox } = textureParams;
                context.iblTextures = {
                    lut_ggx: glTexture(gl, lut_ggx),
                    diffuse: glTexture(gl, diffuse),
                    specular: glTexture(gl, specular),
                    skybox: glTexture(gl, skybox),
                    samplerMip: this.resources.samplerMip,
                    samplerSingle: this.resources.samplerSingle,
                    numMipMaps: data.numMipMaps,
                };
            } else {
                context.iblTextures = undefined;
            }
            data.textureParams = undefined; // we already copied the pixels into texture, so get no longer need the original.
        }

        if (context.hasStateChanged({ background }) || textureParams) {
            this.updateUniforms(state);
            context.updateUniformBuffer(resources.uniforms, this.uniforms);
            const { url } = state.background;
            if (url && (url != data.url)) {
                data.downloadTextures(url).then(() => { context.changed = true; });
            } else if (!url) {
                const { iblTextures } = context;
                if (iblTextures) {
                    const { skybox, diffuse, specular } = iblTextures;
                    gl.deleteTexture(skybox);
                    gl.deleteTexture(diffuse);
                    gl.deleteTexture(specular);
                    context.iblTextures = undefined;
                    data.textureParams = null;
                }
            }
            data.url = url;
        }
    }

    prepass() {
        glClear(this.context.gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
    }

    render(state: DerivedRenderState) {
        const { context, resources } = this;
        const { program, uniforms, samplerSingle, samplerMip } = resources;
        const { gl, cameraUniforms } = context;

        glState(gl, {
            drawBuffers: ["NONE", "COLOR_ATTACHMENT1", "COLOR_ATTACHMENT2", "COLOR_ATTACHMENT3"],
        });
        if (!context.usePrepass) {
            glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
        }
        glClear(gl, { kind: "COLOR", drawBuffer: 1, type: "Float", color: [Number.NaN, Number.NaN, 0, 0] });
        glClear(gl, { kind: "COLOR", drawBuffer: 2, type: "Float", color: [Number.POSITIVE_INFINITY, 0, 0, 0] });
        glClear(gl, { kind: "COLOR", drawBuffer: 3, type: "Uint", color: [0xffffffff, 0xffffffff, 0, 0] }); // 0xffff is bit-encoding for Float16.nan. (https://en.wikipedia.org/wiki/Half-precision_floating-point_format)
        glState(gl, {
            drawBuffers: ["COLOR_ATTACHMENT0"],
        });

        if (context.iblTextures) {
            const { skybox, diffuse } = context.iblTextures;
            const { textureUniformLocations } = this;
            glState(gl, {
                program,
                uniformBuffers: [cameraUniforms, uniforms],
                textures: [
                    { kind: "TEXTURE_CUBE_MAP", texture: skybox, sampler: samplerSingle, uniform: textureUniformLocations.skybox },
                    { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerMip, uniform: textureUniformLocations.diffuse },
                ],
                depthTest: false,
                depthWriteMask: false,
            });
            glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
        } else {
            glClear(gl, { kind: "COLOR", drawBuffer: 0, color: state.background.color });
        }
    }

    contextLost() {
        const { data } = this;
        data.url = undefined; // force a envmap texture reload
    }

    dispose() {
        const { context, resources } = this;
        const { iblTextures } = context;
        const { gl } = context;
        this.contextLost();
        glDelete(gl, resources);
        if (iblTextures) {
            glDelete(gl, { resources: iblTextures });
            context.iblTextures = undefined;
        }
    }
}
