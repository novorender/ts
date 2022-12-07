import type { DerivedRenderState, Matrices, RenderContext, RenderStateCamera, RenderStateGrid } from "core3d";
import { CoordSpace } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy, glBuffer, glProgram, glDraw, glState, glDelete, glUniformsInfo } from "webgl2";
import { mat4, vec3, vec4 } from "gl-matrix";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class GridModule implements RenderModule {
    readonly uniforms;
    constructor() {
        this.uniforms = createUniformBufferProxy({
            worldClipMatrix: "mat4",
            origin: "vec3",
            axisX: "vec3",
            axisY: "vec3",
            cameraPosition: "vec3",
            size1: "float",
            size2: "float",
            color: "vec3",
            distance: "float",
        });
    }

    withContext(context: RenderContext) {
        return new GridModuleContext(context, this);
    }
}

interface RelevantRenderState {
    camera: RenderStateCamera;
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
        const program = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks: ["Grid"] });
        const uniformInfos = glUniformsInfo(gl, program);
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: data.uniforms.buffer });
        this.resources = { program, uniforms } as const;
    }

    render(state: DerivedRenderState) {
        const { context, resources, data } = this;
        const { program, uniforms } = resources;
        const { gl } = context;
        if (this.state.hasChanged(state)) {
            this.updateUniforms(state);
            context.updateUniformBuffer(uniforms, data.uniforms);
        }

        if (state.grid.enabled) {
            glState(gl, {
                program,
                uniformBuffers: [uniforms],
                depthTest: true,
                depthWriteMask: false,
                blendEnable: true,
                blendSrcRGB: "SRC_ALPHA",
                blendDstRGB: "ONE_MINUS_SRC_ALPHA",
                blendSrcAlpha: "ZERO",
                blendDstAlpha: "ONE",
            });
            glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
        }
    }

    private updateUniforms(state: RelevantRenderState) {
        const { data } = this;
        const { values } = data.uniforms;
        const { grid, matrices, camera } = state;
        const { axisX, axisY, origin } = grid;
        values.worldClipMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.Clip);
        values.origin = origin;
        values.axisX = axisX;
        values.axisY = axisY;
        values.color = grid.color;
        values.size1 = grid.size1;
        values.size2 = grid.size2;
        values.cameraPosition = camera.position;
        values.distance = grid.distance;
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