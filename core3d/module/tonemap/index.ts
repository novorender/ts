import type { DerivedRenderState, RenderContext, RenderStateCamera, RenderStateTonemapping } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformsProxy, glProgram, glSampler, glDraw, glUniformLocations, glState, glDelete, glBuffer } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class TonemapModule implements RenderModule {
    readonly uniforms = {
        exposure: "float",
        mode: "uint",
        maxLinearDepth: "float",
    } as const;

    withContext(context: RenderContext) {
        return new TonemapModuleInstance(context, this);
    }
}

interface RelevantRenderState {
    readonly camera: RenderStateCamera;
    readonly tonemapping: RenderStateTonemapping;
};

class TonemapModuleInstance implements RenderModuleContext {
    readonly state;
    readonly uniforms;
    readonly textureUniformLocations;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: TonemapModule) {
        const { gl } = context;
        this.state = new RenderModuleState<RelevantRenderState>();
        this.uniforms = createUniformsProxy(data.uniforms);
        const uniformBufferBlocks = ["Tonemapping"];
        const program = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks });
        const sampler = glSampler(gl, { minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: this.uniforms.buffer.byteLength });
        this.resources = { program, sampler, uniforms } as const;
        this.textureUniformLocations = glUniformLocations(gl, program, ["color", "normal", "depth", "info", "zbuffer"], "textures_");
    }

    update(state: DerivedRenderState) {
        const { context } = this;
        const { uniforms } = this.resources
        const { camera, tonemapping } = state;

        if (this.state.hasChanged({ camera, tonemapping })) {
            const { camera, tonemapping } = state;
            const { values } = this.uniforms;
            values.exposure = Math.pow(2, tonemapping.exposure);
            values.mode = tonemapping.mode;
            values.maxLinearDepth = camera.far;
            context.updateUniformBuffer(uniforms, this.uniforms);
        }
    }


    render() {
        const { context, textureUniformLocations } = this;
        const { program, sampler, uniforms } = this.resources
        const { gl } = context;
        const { resources } = context.buffers;

        glState(gl, {
            program,
            uniformBuffers: [uniforms],
            textures: [
                { kind: "TEXTURE_2D", texture: resources.color, sampler, uniform: textureUniformLocations.color },
                { kind: "TEXTURE_2D", texture: resources.normal, sampler, uniform: textureUniformLocations.normal },
                { kind: "TEXTURE_2D", texture: resources.linearDepth, sampler, uniform: textureUniformLocations.depth },
                { kind: "TEXTURE_2D", texture: resources.info, sampler, uniform: textureUniformLocations.info },
                { kind: "TEXTURE_2D", texture: resources.depth, sampler, uniform: textureUniformLocations.zbuffer },
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
