import type { DerivedRenderState, RenderContext } from "core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glDraw, glState, type UniformTypes } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat4, vec3 } from "gl-matrix";

export class ToonModule implements RenderModule {
    readonly kind = "toon_outline";
    readonly uniforms = {
        color: "vec3",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new ToonModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const bin = context.resourceBin("Grid");
        const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
        const sampler = bin.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const textureNames = ["color", "pick", "zbuffer"] as const;
        const textureUniforms = textureNames.map(name => `textures.${name}`);

        const program = await context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks: ["Camera"], textureUniforms })
        return { bin, uniforms, sampler, program } as const;
    }
}

type Uniforms = ReturnType<ToonModule["createUniforms"]>;
type Resources = Awaited<ReturnType<ToonModule["createResources"]>>;

function isEnabled(context: RenderContext, state: DerivedRenderState) {
    return state.toonOutline.enabled && (context.isIdleFrame || !state.toonOutline.onlyOnIdleFrame);
}

class ToonModuleContext implements RenderModuleContext {
    constructor(readonly context: RenderContext, readonly module: ToonModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { uniforms } = resources;
        const { toonOutline, localSpaceTranslation } = state;
        if (context.hasStateChanged({ toonOutline, localSpaceTranslation })) {
            const { values } = this.uniforms;
            values.color = toonOutline.color;
            context.updateUniformBuffer(uniforms, this.uniforms);
        }
        if (context.isRendering() && !context.isPickBuffersValid() && isEnabled(context, state)) {
            context.renderPickBuffers();
        }
    }

    render(state: DerivedRenderState) {
        const { context, resources } = this;
        const { program, uniforms, sampler } = resources;
        const { gl, cameraUniforms } = context;
        const { textures } = context.buffers;

        if (context.isRendering() && context.isPickBuffersValid() && isEnabled(context, state)) {
            glState(gl, {
                program,
                uniformBuffers: [cameraUniforms, uniforms],
                textures: [
                    { kind: "TEXTURE_2D", texture: textures.color, sampler },
                    { kind: "TEXTURE_2D", texture: textures.pick, sampler },
                    { kind: "TEXTURE_2D", texture: textures.depth, sampler },
                ],
                sample: {
                    alphaToCoverage: true
                },
                blend: {
                    enable: false,
                    srcRGB: "SRC_ALPHA",
                    dstRGB: "ONE_MINUS_SRC_ALPHA",
                    srcAlpha: "ONE",
                    dstAlpha: "ONE",
                },
                depth: {
                    test: false,
                    writeMask: false,
                },
            });
            const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
            context["addRenderStatistics"](stats);
        }
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}