import type { DerivedRenderState, RenderContext } from "core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glDraw, glState, glUBOProxy, type UniformTypes } from "webgl2";

/** @internal */
export class ClippingModule implements RenderModule {
    readonly kind = "clipping";
    readonly uniforms = {
        "colors.0": "vec4",
        "colors.1": "vec4",
        "colors.2": "vec4",
        "colors.3": "vec4",
        "colors.4": "vec4",
        "colors.5": "vec4",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new ClippingModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const { vertexShader, fragmentShader } = context.imports.shaders.clipping.render;
        const bin = context.resourceBin("Clipping");
        const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.buffer.byteLength });
        const uniformBufferBlocks = ["Camera", "Clipping", "Colors"];
        const program = await context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks });
        return { bin, uniforms, program } as const;
    }
}

type Uniforms = ReturnType<ClippingModule["createUniforms"]>;
type Resources = Awaited<ReturnType<ClippingModule["createResources"]>>;

class ClippingModuleContext implements RenderModuleContext {
    constructor(readonly context: RenderContext, readonly module: ClippingModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { clipping } = state;
        if (context.hasStateChanged({ clipping })) {
            const { planes } = clipping;
            const values = this.uniforms.values;
            for (let i = 0; i < planes.length; i++) {
                const { color } = planes[i];
                const idx = i as 0 | 1 | 2 | 3 | 4 | 5;
                values[`colors.${idx}` as const] = color ?? [0, 0, 0, 0];
            }
        }
        context.updateUniformBuffer(resources.uniforms, this.uniforms);
    }

    render(state: DerivedRenderState) {
        const { context, resources } = this;
        const { program, uniforms } = resources;
        const { gl, cameraUniforms, clippingUniforms } = context;
        const { clipping } = state;

        if (clipping.draw) {
            glState(gl, {
                program,
                uniformBuffers: [cameraUniforms, clippingUniforms, uniforms],
                depth: {
                    test: true,
                    // writeMask: true,
                },
                blend: {
                    enable: true,
                    srcRGB: "SRC_ALPHA",
                    dstRGB: "ONE_MINUS_SRC_ALPHA",
                    srcAlpha: "ZERO",
                    dstAlpha: "ONE",
                },
            });
            const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
            context.addRenderStatistics(stats);
        }
    }

    pick(state: DerivedRenderState) {
        return this.render(state);
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}