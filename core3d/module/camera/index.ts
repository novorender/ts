import { RenderContext, RenderStateOutput, DerivedRenderState } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy } from "../uniforms";
import { CoordSpace, Matrices } from "core3d/matrices";

export class CameraModule implements RenderModule {
    readonly uniformsData;

    constructor(readonly initialState: DerivedRenderState) {
        this.uniformsData = createUniformBufferProxy({
            clipViewMatrix: "mat4",
            viewClipMatrix: "mat4",
            worldViewNormalMatrix: "mat3",
            viewWorldNormalMatrix: "mat3",
        });
        updateUniforms(this.uniformsData.uniforms, initialState);
    }

    withContext(context: RenderContext) {
        return new CameraModuleInstance(context, this.uniformsData, this.initialState);
    }
}

type UniformsData = CameraModule["uniformsData"];

interface RelevantRenderState {
    readonly output: RenderStateOutput;
    readonly matrices: Matrices;
}

class CameraModuleInstance implements RenderModuleContext {
    readonly state;
    readonly cameraUniformsBuffer: WebGLBuffer;

    constructor(readonly context: RenderContext, readonly cameraUniformsData: UniformsData, initialState: RelevantRenderState) {
        this.state = new RenderModuleState(initialState);
        const { renderer } = context;
        // create static GPU resources here
        context.cameraUniformsBuffer = this.cameraUniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: cameraUniformsData.buffer });
    }

    render(state: DerivedRenderState) {
        const { context, cameraUniformsBuffer } = this;
        const { renderer } = context;
        const { output, matrices } = state;
        if (this.state.hasChanged({ output, matrices })) {
            const { cameraUniformsData } = this;
            updateUniforms(cameraUniformsData.uniforms, state);
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: cameraUniformsData.buffer, targetBuffer: cameraUniformsBuffer });
        }
    }

    dispose() {
        const { renderer } = this.context;
        renderer.deleteBuffer(this.cameraUniformsBuffer);
    }
}

function updateUniforms(uniforms: UniformsData["uniforms"], state: RelevantRenderState) {
    const { matrices } = state;
    Object.assign(uniforms, matrices4x4(matrices), matrices3x3(matrices));
}

function matrices4x4(matrices: Matrices) {
    return {
        clipViewMatrix: matrices.getMatrix(CoordSpace.Clip, CoordSpace.View),
        viewClipMatrix: matrices.getMatrix(CoordSpace.View, CoordSpace.Clip),
    } as const;
}

function matrices3x3(matrices: Matrices) {
    return {
        worldViewNormalMatrix: matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View),
        viewWorldNormalMatrix: matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World),
    };
}
