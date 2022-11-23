import { DerivedRenderState, RenderContext, RenderStateGrid } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy } from "../uniforms";
import { CoordSpace, Matrices } from "core3d/matrices";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat4 } from "gl-matrix";

export class GridModule implements RenderModule {
    readonly uniformsData;
    constructor(readonly initialState: DerivedRenderState) {
        this.uniformsData = createUniformBufferProxy({
            objectClipMatrix: "mat4",
            color: "vec4",
            size: "int",
            spacing: "float",
        });
        updateUniforms(this.uniformsData.uniforms, initialState);
    }

    withContext(context: RenderContext) {
        return new GridModuleContext(context, this.uniformsData, this.initialState);
    }
}

type UniformsData = GridModule["uniformsData"];

interface RelevantRenderState {
    grid: RenderStateGrid;
    matrices: Matrices;
};

// class GridModuleContext extends RenderModuleBase<RelevantRenderState> implements RenderModuleContext {
class GridModuleContext implements RenderModuleContext {
    private readonly state;
    readonly program: WebGLProgram;
    readonly gridUniformsBuffer: WebGLBuffer;

    constructor(readonly context: RenderContext, readonly gridUniformsData: UniformsData, initialState: RelevantRenderState) {
        this.state = new RenderModuleState(initialState);
        const { renderer } = context;
        // create static GPU resources here
        const uniformBufferBlocks = ["Camera", "Grid"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.gridUniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: gridUniformsData.buffer });
    }

    render(state: DerivedRenderState) {
        const { context, program, gridUniformsBuffer } = this;
        const { renderer, cameraUniformsBuffer } = context;
        const size = state.grid.size;
        if (this.state.hasChanged(state)) {
            const { gridUniformsData } = this;
            updateUniforms(gridUniformsData.uniforms, state);
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: gridUniformsData.buffer, targetBuffer: gridUniformsBuffer });
            // const { begin, end } = gridUniformsData.dirtyRange;
            // renderer.update({ kind: "UNIFORM_BUFFER", srcData: gridUniformsData.buffer, targetBuffer: gridUniformsBuffer, size: end - begin, srcOffset: begin, targetOffset: begin });
        }

        if (state.grid.enabled) {
            renderer.state({
                program,
                uniformBuffers: [cameraUniformsBuffer, gridUniformsBuffer],
                depthTest: true,
            });
            renderer.draw({ kind: "arrays", mode: "LINES", count: (size + 1) * 2 * 2 });
        }
    }

    dispose() {
        const { context, program, gridUniformsBuffer } = this;
        const { renderer } = context;
        renderer.deleteProgram(program);
        renderer.deleteBuffer(gridUniformsBuffer);
    }
}

function updateUniforms(uniforms: UniformsData["uniforms"], state: RelevantRenderState) {
    const { grid, matrices } = state;
    const { axisX, axisY, origin } = grid;
    const m = [
        ...axisX, 0,
        ...axisY, 0,
        0, 0, 1, 0,
        ...origin, 1
    ] as Parameters<typeof mat4.fromValues>;
    const worldClipMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.Clip);
    const objectWorldMatrix = mat4.fromValues(...m);
    uniforms.objectClipMatrix = mat4.mul(mat4.create(), worldClipMatrix, objectWorldMatrix);
    uniforms.color = grid.color;
    uniforms.size = grid.size;
    uniforms.spacing = grid.spacing;
}
