import type { DerivedRenderState, Matrices, RenderContext, RenderStateGrid } from "core3d";
import { CoordSpace } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy, glBuffer, glProgram, glDraw, glState, glDelete } from "webgl2";
import { mat4 } from "gl-matrix";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class GridModule implements RenderModule {
    readonly uniforms;
    constructor() {
        this.uniforms = createUniformBufferProxy({
            modelClipMatrix: "mat4",
            color: "vec4",
            size: "int",
            spacing: "float",
        });
    }

    withContext(context: RenderContext) {
        return new GridModuleContext(context, this);
    }
}

interface RelevantRenderState {
    grid: RenderStateGrid;
    matrices: Matrices;
};

// class GridModuleContext extends RenderModuleBase<RelevantRenderState> implements RenderModuleContext {
class GridModuleContext implements RenderModuleContext {
    private readonly state;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: GridModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        const { gl } = context;
        // create static GPU resources here
        const program = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks: ["Camera", "Grid"] });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: data.uniforms.buffer });
        this.resources = { program, uniforms } as const;
    }

    render(state: DerivedRenderState) {
        const { context, resources, data } = this;
        const { program, uniforms } = resources;
        const { gl, cameraUniforms } = context;
        if (this.state.hasChanged(state)) {
            this.updateUniforms(state);
            context.updateUniformBuffer(resources.uniforms, data.uniforms);
        }

        if (state.grid.enabled) {
            const { size } = state.grid;
            glState(gl, {
                program,
                uniformBuffers: [cameraUniforms, uniforms],
                depthTest: true,
            });
            glDraw(gl, { kind: "arrays", mode: "LINES", count: (size + 1) * 2 * 2 });
        }
    }

    private updateUniforms(state: RelevantRenderState) {
        const { data } = this;
        const { values } = data.uniforms;
        const { grid, matrices } = state;
        const { axisX, axisY, origin } = grid;
        const m = [
            ...axisX, 0,
            ...axisY, 0,
            0, 0, 1, 0,
            ...origin, 1
        ] as Parameters<typeof mat4.fromValues>;
        const worldClipMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.Clip);
        const modelWorldMatrix = mat4.fromValues(...m);
        values.modelClipMatrix = mat4.mul(mat4.create(), worldClipMatrix, modelWorldMatrix);
        values.color = grid.color;
        values.size = grid.size;
        values.spacing = grid.spacing;
    }

    contextLost(): void {
    }

    dispose() {
        const { context, resources } = this;
        const { gl } = context;
        this.contextLost();
        glDelete(gl, resources);
    }
}