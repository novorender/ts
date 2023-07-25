import type { DerivedRenderState, RenderContext } from "core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glDraw, glState, type UniformTypes } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

/** @internal */
export class TonemapModule implements RenderModule {
    readonly kind = "tonemap";
    readonly uniforms = {
        exposure: "float",
        mode: "uint",
        maxLinearDepth: "float",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new TonemapModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const bin = context.resourceBin("Tonemap");
        const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.buffer.byteLength });
        const sampler = bin.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const textureNames = ["color", "pick", "zbuffer"] as const;
        const textureUniforms = textureNames.map(name => `textures.${name}`);
        const program = await context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks: ["Tonemapping"], textureUniforms })
        return { bin, uniforms, sampler, program } as const;
    }
}

type Uniforms = ReturnType<TonemapModule["createUniforms"]>;
type Resources = Awaited<ReturnType<TonemapModule["createResources"]>>;

class TonemapModuleContext implements RenderModuleContext {

    constructor(readonly context: RenderContext, readonly module: TonemapModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

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
        const { context, resources } = this;
        const { program, sampler, uniforms } = resources;
        const { gl } = context;
        const { textures } = context.buffers;

        context.buffers.resolveMSAA();

        glState(gl, {
            program,
            uniformBuffers: [uniforms],
            textures: [
                { kind: "TEXTURE_2D", texture: textures.color, sampler },
                { kind: "TEXTURE_2D", texture: textures.pick, sampler },
                { kind: "TEXTURE_2D", texture: textures.depth, sampler },
            ],
            frameBuffer: null,
            drawBuffers: ["BACK"],
            depth: {
                test: false,
                writeMask: false,
            },
        });

        const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
        context.addRenderStatistics(stats);
    }

    contextLost() {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}
