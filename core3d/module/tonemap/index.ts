import type { DerivedRenderState, RenderContext } from "core3d";
import { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glProgram, glSampler, glDraw, glState, glDelete, glBuffer, UniformTypes } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class TonemapModule implements RenderModule {
    readonly uniforms = {
        exposure: "float",
        mode: "uint",
        maxLinearDepth: "float",
    } as const satisfies Record<string, UniformTypes>;

    withContext(context: RenderContext) {
        return new TonemapModuleContext(context, this);
    }
}

class TonemapModuleContext implements RenderModuleContext {
    readonly uniforms;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: TonemapModule) {
        const { gl, commonChunk } = context;
        this.uniforms = glUBOProxy(data.uniforms);
        const uniformBufferBlocks = ["Tonemapping"];
        const textureNames = ["color", "depth", "info", "zbuffer"] as const;
        const textureUniforms = textureNames.map(name => `textures.${name}`);
        const program = glProgram(gl, { vertexShader, fragmentShader, commonChunk, uniformBufferBlocks, textureUniforms });
        const sampler = glSampler(gl, { minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", byteSize: this.uniforms.buffer.byteLength });
        this.resources = { program, sampler, uniforms } as const;
    }

    update(state: DerivedRenderState) {
        const { context } = this;
        const { uniforms } = this.resources
        const { camera, tonemapping } = state;

        if (context.hasStateChanged({ camera, tonemapping })) {
            const { camera, tonemapping } = state;
            const { values } = this.uniforms;
            values.exposure = Math.pow(2, tonemapping.exposure);
            values.mode = tonemapping.mode;
            values.maxLinearDepth = camera.far;
            context.updateUniformBuffer(uniforms, this.uniforms);
        }
    }

    render() {
        const { context } = this;
        const { program, sampler, uniforms } = this.resources
        const { gl } = context;
        const { resources } = context.buffers;

        glState(gl, {
            program,
            uniformBuffers: [uniforms],
            textures: [
                { kind: "TEXTURE_2D", texture: resources.color, sampler },
                { kind: "TEXTURE_2D", texture: resources.linearDepth, sampler },
                { kind: "TEXTURE_2D", texture: resources.info, sampler },
                { kind: "TEXTURE_2D", texture: resources.depth, sampler },
            ],
            frameBuffer: null,
            drawBuffers: ["BACK"],
            depth: {
                test: false,
                writeMask: false,
            },
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
