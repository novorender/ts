import type { DerivedRenderState, RenderContext } from "@novorender/core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glDraw, glState, glUBOProxy, type UniformTypes } from "@novorender/webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { ResourceBin } from "@novorender/core3d/resource";

export class ClippingModule implements RenderModule {
    readonly uniforms = {
        "colors.0": "vec4",
        "colors.1": "vec4",
        "colors.2": "vec4",
        "colors.3": "vec4",
        "colors.4": "vec4",
        "colors.5": "vec4",
    } as const satisfies Record<string, UniformTypes>;

    withContext(context: RenderContext) {
        return new ClippingModuleContext(context, this, context.resourceBin("Clipping"));
    }
}

class ClippingModuleContext implements RenderModuleContext {
    readonly uniforms;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: ClippingModule, readonly resourceBin: ResourceBin) {
        this.uniforms = glUBOProxy(data.uniforms);
        const { commonChunk } = context;
        const program = resourceBin.createProgram({ vertexShader, fragmentShader, commonChunk, uniformBufferBlocks: ["Camera", "Clipping", "Colors"] });
        const uniforms = resourceBin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: this.uniforms.buffer.byteLength });
        this.resources = { program, uniforms } as const;
    }

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
                drawBuffers: context.drawBuffers(),
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
            context["addRenderStatistics"](stats);
        }
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resourceBin.dispose();
    }
}