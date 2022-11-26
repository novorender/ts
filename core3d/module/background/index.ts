import { DerivedRenderState, RenderContext, RenderStateBackground } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy, UniformsHandler, UniformsProxy } from "../../uniforms";
import { getUniformLocations, TextureParams, WebGL2Renderer } from "webgl2";
import { KTX } from "./ktx";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class BackgroundModule implements RenderModule {
    readonly uniformsProxy;
    private abortController: AbortController | undefined;
    url: string | undefined;
    textureParams: {
        readonly background: TextureParams;
        readonly irradiance: TextureParams;
        readonly radiance: TextureParams;
    } | null | undefined = null; // null means no textures, whereas undefined means no change in textures

    constructor() {
        this.uniformsProxy = createUniformBufferProxy({
            envBlurNormalized: "float",
            mipCount: "int",
        });
    }

    withContext(context: RenderContext) {
        return new BackgroundModuleInstance(context, this);
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
                download(new URL("background.ktx", baseUrl)),
                download(new URL("irradiance.ktx", baseUrl)),
                download(new URL("radiance.ktx", baseUrl)),
            ];
            const [background, irradiance, radiance] = await Promise.all(promises);
            this.textureParams = { background, irradiance, radiance } as const;
        } finally {
            this.abortController = undefined;
        }

        async function download(url: URL) {
            const response = await fetch(url, { mode: "cors", signal });
            if (response.ok) {
                var ktxData = await response.arrayBuffer();
                var params = KTX.parseKTX(ktxData);
                // const texture = renderer.createTexture(params);
                return params;
            } else {
                throw new Error(`HTTP Error:${response.status} ${response.status}`);
            }
        }
    }

}

interface RelevantRenderState {
    background: RenderStateBackground;
};

class BackgroundModuleInstance implements RenderModuleContext {
    readonly state;
    readonly program;
    readonly uniforms;
    readonly uniformLocations;
    readonly sampler: WebGLSampler;
    readonly samplerMip: WebGLSampler;
    textures: undefined | {
        readonly background: WebGLTexture;
        readonly irradiance: WebGLTexture;
        readonly radiance: WebGLTexture;
    };

    constructor(readonly context: RenderContext, readonly data: BackgroundModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        const { renderer } = context;
        const uniformBufferBlocks = ["Camera", "Background"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.uniforms = new UniformsHandler(renderer, data.uniformsProxy);
        this.uniformLocations = getUniformLocations(renderer.gl, this.program, "texBackground", "texRadiance");
        this.sampler = renderer.createSampler({ minificationFilter: "LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        this.samplerMip = renderer.createSampler({ minificationFilter: "LINEAR_MIPMAP_LINEAR", magnificationFilter: "LINEAR", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
    }

    updateUniforms(state: RelevantRenderState) {
        const { background } = state;
        const { uniforms } = this;
        const { values } = uniforms;
        values.envBlurNormalized = background.blur ?? 0;
        values.mipCount = 9; // TODO: Compute from actual texture file
        uniforms.update();
    }

    render(state: DerivedRenderState) {
        const { context, program, uniforms, data, textures } = this;
        const { renderer, cameraUniformsBuffer } = context;
        const { textureParams } = data;
        const { background } = state;

        if (textureParams !== undefined) {
            if (textureParams) {
                const { background, irradiance, radiance } = textureParams;
                this.textures = {
                    background: renderer.createTexture(background),
                    irradiance: renderer.createTexture(irradiance),
                    radiance: renderer.createTexture(radiance),
                };
            }
            data.textureParams = undefined; // we don't really want to keep a js mem copy of these.
        }

        if (this.state.hasChanged({ background })) {
            this.updateUniforms(state);

            const { url } = state.background;
            if (url && (url != data.url)) {
                data.downloadTextures(url).then(() => { context.changed = true; });
            } else if (!url) {
                const { textures } = this;
                if (textures) {
                    const { background, irradiance, radiance } = textures;
                    renderer.deleteTexture(background);
                    renderer.deleteTexture(irradiance);
                    renderer.deleteTexture(radiance);
                    this.textures = undefined;
                    data.textureParams = null;
                }
            }
            data.url = url;
        }

        if (this.textures) {
            renderer.clear({ kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
            const { uniformLocations, textures, sampler, samplerMip } = this;
            renderer.state({
                program,
                uniformBuffers: [cameraUniformsBuffer, uniforms.buffer],
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

    contextLost() {
        this.data.url = undefined; // force a envmap texture reload
    }

    dispose() {
        const { context, program, uniforms, sampler, textures } = this;
        const { renderer } = context;
        this.contextLost();
        if (textures) {
            const { background, irradiance, radiance } = textures;
            renderer.deleteTexture(background);
            renderer.deleteTexture(irradiance);
            renderer.deleteTexture(radiance);
            this.textures = undefined;
        }
        renderer.deleteSampler(sampler);
        uniforms.dispose();
        renderer.deleteProgram(program);
    }
}
