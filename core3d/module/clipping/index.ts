import type { DerivedRenderState, Matrices, RenderContext, RenderStateCamera, RenderStateClipping } from "core3d";
import { CoordSpace } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformsProxy, glBuffer, glProgram, glDraw, glState, glDelete, glUniformsInfo } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat4, vec3, vec4 } from "gl-matrix";

export class ClippingModule implements RenderModule {
    readonly uniforms = {
        "planes.0": "vec4",
        "planes.1": "vec4",
        "planes.2": "vec4",
        "planes.3": "vec4",
        "planes.4": "vec4",
        "planes.5": "vec4",
        "colors.0": "vec4",
        "colors.1": "vec4",
        "colors.2": "vec4",
        "colors.3": "vec4",
        "colors.4": "vec4",
        "colors.5": "vec4",
        numPlanes: "uint",
        mode: "uint",
    } as const;

    withContext(context: RenderContext) {
        return new ClippingModuleContext(context, this);
    }
}

interface RelevantRenderState {
    clipping: RenderStateClipping;
    matrices: Matrices;
};

class ClippingModuleContext implements RenderModuleContext {
    private readonly state;
    readonly uniforms;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: ClippingModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        this.uniforms = createUniformsProxy(data.uniforms);
        const { gl } = context;
        const program = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks: ["Camera", "Clipping"] });
        const info = glUniformsInfo(gl, program);
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: this.uniforms.buffer });
        context.clippingUniforms = uniforms;
        this.resources = { program, uniforms } as const;
    }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { clipping, matrices } = state;
        const { uniforms } = resources;
        if (this.state.hasChanged({ clipping, matrices })) {
            const { values } = this.uniforms;
            const { enabled, mode, planes } = clipping;
            // transform clipping planes into view space
            const normal = vec3.create();
            const position = vec3.create();
            const matrix = matrices.getMatrix(CoordSpace.World, CoordSpace.View);
            const matrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
            mat4.getTranslation(position, matrix);
            for (let i = 0; i < planes.length; i++) {
                const { normalOffset, color } = planes[i];
                const [x, y, z, offset] = normalOffset;
                vec3.set(normal, x, y, z);
                vec3.transformMat3(normal, normal, matrixNormal);
                const distance = offset + vec3.dot(position, normal);
                const plane = vec4.fromValues(normal[0], normal[1], normal[2], -distance);
                const idx = i as 0 | 1 | 2 | 3 | 4 | 5;
                values[`planes.${idx}` as const] = plane;
                values[`colors.${idx}` as const] = color ?? [0, 0, 0, 0];
            }
            values["numPlanes"] = enabled ? planes.length : 0;
            values["mode"] = mode;
            context.updateUniformBuffer(uniforms, this.uniforms);
        }
    }

    render() {
        const { context, resources, state } = this;
        const { program, uniforms } = resources;
        const { gl, cameraUniforms } = context;
        const { current } = state;

        if (current?.clipping.enabled && current?.clipping.draw) {
            glState(gl, {
                program,
                uniformBuffers: [cameraUniforms, uniforms],
                drawBuffers: ["COLOR_ATTACHMENT0", "COLOR_ATTACHMENT1", "COLOR_ATTACHMENT2", "COLOR_ATTACHMENT3"],
                depthTest: true,
                // depthWriteMask: true,
                blendEnable: true,
                blendSrcRGB: "SRC_ALPHA",
                blendDstRGB: "ONE_MINUS_SRC_ALPHA",
                blendSrcAlpha: "ZERO",
                blendDstAlpha: "ONE",
            });
            glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
        }
    }

    contextLost(): void {
    }

    dispose() {
        const { context, resources } = this;
        const { gl } = context;
        this.contextLost();
        context.clippingUniforms = undefined;
        glDelete(gl, resources);
    }
}