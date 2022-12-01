import type { DerivedRenderState, RenderContext, RenderStateCamera, RenderStateTonemapping } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy, glProgram, glSampler, glDraw, glUniformLocations, glState, glDelete, glBuffer } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class TonemapdModule implements RenderModule {
    readonly uniforms;

    constructor() {
        this.uniforms = createUniformBufferProxy({
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
    readonly textureUniformLocations;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: TonemapdModule) {
        const { gl } = context;
        this.state = new RenderModuleState<RelevantRenderState>();
        const uniformBufferBlocks = ["Tonemapping"];
        const program = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks });
        const sampler = glSampler(gl, { minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: data.uniforms.buffer.byteLength });
        this.resources = { program, sampler, uniforms } as const;
        this.textureUniformLocations = glUniformLocations(gl, program, ["color", "normal", "depth", "info"], "textures_");
    }

    updateUniforms(state: RelevantRenderState) {
        const { camera, tonemapping } = state;
        const { values } = this.data.uniforms;
        values.exposure = Math.pow(2, tonemapping.exposure);
        values.mode = tonemapping.mode;
        values.maxLinearDepth = camera.far;
    }

    render(state: DerivedRenderState) {
        const { context, textureUniformLocations, data } = this;
        const { program, sampler, uniforms } = this.resources
        const { gl } = context;
        const { camera, tonemapping } = state;
        const { resources } = context.buffers;

        if (this.state.hasChanged({ camera, tonemapping })) {
            this.updateUniforms(state);
            context.updateUniformBuffer(uniforms, data.uniforms);
        }
        glState(gl, {
            program,
            uniformBuffers: [uniforms],
            textures: [
                { kind: "TEXTURE_2D", texture: resources.color, sampler, uniform: textureUniformLocations.color },
                { kind: "TEXTURE_2D", texture: resources.normal, sampler, uniform: textureUniformLocations.normal },
                { kind: "TEXTURE_2D", texture: resources.linearDepth, sampler, uniform: textureUniformLocations.depth },
                { kind: "TEXTURE_2D", texture: resources.info, sampler, uniform: textureUniformLocations.info },
            ],
            frameBuffer: null,
            drawBuffers: ["BACK"],
            depthTest: false,
            depthWriteMask: false,
        });

        glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
    }

    contextLost() {
    }

    dispose() {
        const { context, resources } = this;
        const { gl } = context;
        this.contextLost();
        glDelete(gl, resources);
    }
}
