import { mat4, vec3 } from "gl-matrix";
import { RenderState, RenderContext, RenderStateGrid } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { createUniformBufferProxy } from "../uniforms";

export class GridModule implements RenderModule {
    readonly uniformsData;
    constructor(readonly initialState: RenderState) {
        this.uniformsData = createUniformBufferProxy({
            origin: "vec3",
            axisX: "vec3",
            axisY: "vec3",
            color: "vec4",
            size: "int",
            spacing: "float",
        });
        updateUniforms(this.uniformsData.uniforms, initialState.grid);
    }

    withContext(context: RenderContext) {
        return new GridModuleContext(context, this.uniformsData, this.initialState);
    }
}

type UniformsData = GridModule["uniformsData"];

interface RelevantRenderState {
    grid: RenderStateGrid
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

    render(state: RenderState) {
        const { context, program, gridUniformsBuffer } = this;
        const { renderer, cameraUniformsBuffer } = context;
        const size = state.grid.size;
        if (this.state.hasChanged(state)) {
            const { gridUniformsData } = this;
            updateUniforms(gridUniformsData.uniforms, state.grid);
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: gridUniformsData.buffer, targetBuffer: gridUniformsBuffer });
            // const { begin, end } = gridUniformsData.dirtyRange;
            // renderer.update({ kind: "UNIFORM_BUFFER", srcData: gridUniformsData.buffer, targetBuffer: gridUniformsBuffer, size: end - begin, srcOffset: begin, targetOffset: begin });
        }

        renderer.state({
            program,
            uniformBuffers: [cameraUniformsBuffer, gridUniformsBuffer],
            // uniforms: [
            //     { kind: "4f", name: "color", value: [1, 1, 1, 1] },
            //     { kind: "1i", name: "size", value: size },
            //     { kind: "1f", name: "spacing", value: spacing },
            // ],
            depthTest: true,
        });

        renderer.draw({ kind: "arrays", mode: "LINES", count: (size + 1) * 2 * 2 });
    }

    dispose() {
        const { context, program, gridUniformsBuffer } = this;
        const { renderer } = context;
        renderer.deleteProgram(program);
        renderer.deleteBuffer(gridUniformsBuffer);
    }
}

function updateUniforms(uniforms: UniformsData["uniforms"], grid: RenderStateGrid) {
    uniforms.color = grid.color;
    uniforms.origin = grid.origin;
    uniforms.axisX = grid.axisX;
    uniforms.axisY = grid.axisY;
    uniforms.size = grid.size;
    uniforms.spacing = grid.spacing;
}
