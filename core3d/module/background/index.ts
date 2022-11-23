import { DerivedRenderState, RenderContext, RenderStateBackground } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy } from "../uniforms";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { KTX } from "core3d/ktx";
import { getUniformLocations } from "@novorender/webgl2";

export class BackgroundModule implements RenderModule {
    readonly uniformsData;

    constructor(readonly initialState: DerivedRenderState) {
        this.uniformsData = createUniformBufferProxy({
            envBlurNormalized: "float",
            mipCount: "int",
        });
        updateUniforms(this.uniformsData.uniforms, initialState);
    }

    withContext(context: RenderContext) {
        return new BackgroundModuleInstance(context, this.uniformsData, this.initialState);
    }
}

type UniformsData = BackgroundModule["uniformsData"];

interface RelevantRenderState {
    background: RenderStateBackground;
};


class BackgroundModuleInstance implements RenderModuleContext {
    readonly state;
    readonly program;
    readonly backgroundUniformsBuffer: WebGLBuffer;
    readonly uniformLocations;
    readonly sampler: WebGLSampler;
    readonly samplerMip: WebGLSampler;
    url: string | undefined;
    abortController: AbortController | undefined;
    textures: undefined | {
        readonly background: WebGLTexture;
        readonly irradiance: WebGLTexture;
        readonly radiance: WebGLTexture;
    };

    constructor(readonly context: RenderContext, readonly backgroundUniformsData: UniformsData, readonly initialState: DerivedRenderState) {
        this.state = new RenderModuleState<RelevantRenderState>();
        const { renderer } = context;
        const uniformBufferBlocks = ["Camera", "Background"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.uniformLocations = getUniformLocations(renderer.gl, this.program, "texBackground", "texRadiance");
        this.sampler = renderer.createSampler({ minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        this.samplerMip = renderer.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        this.backgroundUniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: backgroundUniformsData.buffer });
    }

    render(state: DerivedRenderState) {
        const { context, program, backgroundUniformsBuffer } = this;
        const { renderer, cameraUniformsBuffer } = context;
        const { background } = state;

        if (this.state.hasChanged({ background })) {
            const { backgroundUniformsData } = this;
            const { url } = state.background;
            updateUniforms(backgroundUniformsData.uniforms, state);
            // abort any pending downloads
            if (this.abortController) {
                this.abortController.abort();
                this.abortController = undefined;
            }
            if (url && url != this.url) {
                this.downloadTextures(url).then(textures => {
                    this.textures = textures;
                    context.changed = true;
                })
            } else if (!url) {
                const { textures } = this;
                if (textures) {
                    const { background, irradiance, radiance } = textures;
                    renderer.deleteTexture(background);
                    renderer.deleteTexture(irradiance);
                    renderer.deleteTexture(radiance);
                    this.textures = undefined;
                }
            }
            this.url = url;
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: backgroundUniformsData.buffer, targetBuffer: backgroundUniformsBuffer });
        }


        if (this.textures) {
            renderer.clear({ kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
            const { uniformLocations, textures, sampler, samplerMip } = this;
            renderer.state({
                program,
                uniformBuffers: [cameraUniformsBuffer, backgroundUniformsBuffer],
                uniforms: [
                    { kind: "1i", location: uniformLocations.texBackground, value: 0 },
                    { kind: "1i", location: uniformLocations.texRadiance, value: 1 },
                ],
                textures: [
                    { kind: "TEXTURE_CUBE_MAP", texture: textures.background, sampler },
                    { kind: "TEXTURE_CUBE_MAP", texture: textures.radiance, sampler: samplerMip },
                ],
                depthTest: false,
                depthWriteMask: false,
            });

            renderer.draw({ kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
        } else {
            renderer.clear({ kind: "back_buffer", color: state.background.color, depth: 1.0 });
        }
    }

    dispose() {
        const { context, program, backgroundUniformsBuffer, sampler, textures, abortController } = this;
        const { renderer } = context;
        if (abortController) {
            abortController.abort();
        }
        if (textures) {
            const { background, irradiance, radiance } = textures;
            renderer.deleteTexture(background);
            renderer.deleteTexture(irradiance);
            renderer.deleteTexture(radiance);
            this.textures = undefined;
        }
        renderer.deleteSampler(sampler);
        renderer.deleteBuffer(backgroundUniformsBuffer);
        renderer.deleteProgram(program);
    }

    // TODO: Move into worker?
    private async downloadTextures(urlDir: string) {
        const { scriptUrl, renderer } = this.context;
        const { signal } = this.abortController = new AbortController();
        const baseUrl = new URL(urlDir, scriptUrl);
        const promises = [
            download(new URL("background.ktx", baseUrl)),
            download(new URL("irradiance.ktx", baseUrl)),
            download(new URL("radiance.ktx", baseUrl)),
        ];
        const [background, irradiance, radiance] = await Promise.all(promises);
        this.abortController = undefined;
        return { background, irradiance, radiance } as const;

        async function download(url: URL) {
            const response = await fetch(url, { mode: "cors", signal });
            if (response.ok) {
                var ktxData = await response.arrayBuffer();
                var params = KTX.parseKTX(ktxData);
                const texture = renderer.createTexture(params);
                return texture;
            } else {
                throw new Error(`HTTP Error:${response.status} ${response.status}`);
            }
        }
    }
}

function updateUniforms(uniforms: UniformsData["uniforms"], state: RelevantRenderState) {
    const { background } = state;
    uniforms.envBlurNormalized = background.blur ?? 0;
    uniforms.mipCount = 9; // TODO: Compute from actual texture file
}
