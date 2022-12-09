import type { DerivedRenderState, Matrices, RenderContext, RenderStateCamera, RenderStateGrid } from "core3d";
import { CoordSpace } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformsProxy, glBuffer, glProgram, glDraw, glState, glDelete } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export class GridModule implements RenderModule {
    readonly uniforms = {
        worldClipMatrix: "mat4",
        origin: "vec3",
        axisX: "vec3",
        axisY: "vec3",
        cameraPosition: "vec3",
        size1: "float",
        size2: "float",
        color: "vec3",
        distance: "float",
    } as const;

    withContext(context: RenderContext) {
        return new GridModuleContext(context, this);
    }
}

interface RelevantRenderState {
    camera: RenderStateCamera;
    grid: RenderStateGrid;
    matrices: Matrices;
};

class GridModuleContext implements RenderModuleContext {
    private readonly state;
    readonly uniforms;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: GridModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        this.uniforms = createUniformsProxy(data.uniforms);
        const { gl } = context;
        const program = glProgram(gl, { vertexShader, fragmentShader, uniformBufferBlocks: ["Grid"] });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: this.uniforms.buffer });
        this.resources = { program, uniforms } as const;
    }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { uniforms } = resources;
        if (this.state.hasChanged(state)) {
            const { data } = this;
            const { values } = this.uniforms;
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
            context.updateUniformBuffer(uniforms, this.uniforms);
        }
    }

    render() {
        const { context, resources, state } = this;
        const { program, uniforms } = resources;
        const { gl } = context;

        if (state.current?.grid.enabled) {
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

    contextLost(): void {
    }

    dispose() {
        const { context, resources } = this;
        const { gl } = context;
        this.contextLost();
        glDelete(gl, resources);
    }
}