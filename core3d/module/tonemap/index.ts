import type { DerivedRenderState, RenderContext, RenderStateCamera, RenderStateTonemapping } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy, UniformsHandler } from "core3d/uniforms";
import { getTextureUniformLocations } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class TonemapdModule implements RenderModule {
    readonly uniformsProxy;

    constructor() {
        this.uniformsProxy = createUniformBufferProxy({
            exposure: "float",
            mode: "uint",
            maxLinearDepth: "float",
        });
    }

    withContext(context: RenderContext) {
        return new TonemapdModuleInstance(context, this);
    }
}

interface RelevantRenderState {
    readonly camera: RenderStateCamera;
    readonly tonemapping: RenderStateTonemapping;
};

class TonemapdModuleInstance implements RenderModuleContext {
    readonly state;
    readonly program;
    readonly uniforms;
    readonly textureUniformLocations;
    readonly sampler: WebGLSampler;

    constructor(readonly context: RenderContext, readonly data: TonemapdModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        const { renderer } = context;
        const uniformBufferBlocks = ["Tonemapping"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.uniforms = new UniformsHandler(renderer, data.uniformsProxy);
        this.textureUniformLocations = getTextureUniformLocations(renderer.gl, this.program, "color", "normal", "depth", "info");
        this.sampler = renderer.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
    }

    updateUniforms(state: RelevantRenderState) {
        const { camera, tonemapping } = state;
        const { uniforms } = this;
        const { values } = uniforms;
        values.exposure = Math.pow(2, tonemapping.exposure);
        values.mode = tonemapping.mode;
        values.maxLinearDepth = camera.far;
        uniforms.update();
    }

    render(state: DerivedRenderState) {
        const { context, program, sampler, uniforms, textureUniformLocations, data } = this;
        const { renderer } = context;
        const { camera, tonemapping } = state;

        if (this.state.hasChanged({ camera, tonemapping })) {
            this.updateUniforms(state);
        }
        renderer.state({
            program,
            uniformBuffers: [uniforms.buffer],
            uniforms: [
                { kind: "1i", location: textureUniformLocations.color, value: 0 },
                { kind: "1i", location: textureUniformLocations.depth, value: 1 },
                { kind: "1i", location: textureUniformLocations.normal, value: 2 },
                { kind: "1i", location: textureUniformLocations.info, value: 3 },
            ],
            textures: [
                { kind: "TEXTURE_2D", texture: context.buffers.color, sampler },
                { kind: "TEXTURE_2D", texture: context.buffers.linearDepth, sampler },
                { kind: "TEXTURE_2D", texture: context.buffers.normal, sampler },
                { kind: "TEXTURE_2D", texture: context.buffers.info, sampler },
            ],
            frameBuffer: null,
            drawBuffers: ["BACK"],
            depthTest: false,
            depthWriteMask: false,
        });

        renderer.draw({ kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
    }

    contextLost() {
    }

    dispose() {
        const { context, program, uniforms, sampler } = this;
        const { renderer } = context;
        this.contextLost();
        renderer.deleteSampler(sampler);
        uniforms.dispose();
        renderer.deleteProgram(program);
    }
}
