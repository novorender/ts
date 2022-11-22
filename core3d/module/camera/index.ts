import { mat3, mat4, vec3, vec4 } from "gl-matrix";
import { RenderState, RenderContext, RenderStateCamera, RenderStateOutput } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy } from "../uniforms";

export class CameraModule implements RenderModule {
    readonly uniformsData;

    constructor(readonly initialState: RenderState) {
        this.uniformsData = createUniformBufferProxy({
            clipViewMatrix: "mat4",
            clipWorldMatrix: "mat4",
            worldViewMatrix: "mat4",
            worldClipMatrix: "mat4",
            viewWorldMatrix: "mat4",
            viewClipMatrix: "mat4",
            clipViewNormalMatrix: "mat3",
            clipWorldNormalMatrix: "mat3",
            worldViewNormalMatrix: "mat3",
            worldClipNormalMatrix: "mat3",
            viewWorldNormalMatrix: "mat3",
            viewClipNormalMatrix: "mat3",
        });
        updateUniforms(this.uniformsData.uniforms, initialState);
    }

    withContext(context: RenderContext) {
        return new CameraModuleInstance(context, this.uniformsData, this.initialState);
    }
}

type UniformsData = CameraModule["uniformsData"];

interface RelevantRenderState {
    output: RenderStateOutput;
    camera: RenderStateCamera;
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

    render(state: RenderState) {
        const { context, cameraUniformsBuffer } = this;
        const { renderer } = context;
        const { camera, output } = state;
        if (this.state.hasChanged({ camera, output })) {
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
    const { camera, output } = state;
    const { width, height } = output;
    const aspectRatio = width / height;
    const fovY = camera.fov * Math.PI / 180;
    const worldView = mat4.fromRotationTranslation(mat4.create(), camera.rotation, camera.position);
    // const worldView = mat4.lookAt(mat4.create(), vec3.fromValues(3, 6, -15), vec3.create(), vec3.fromValues(0, 1, 0));
    // const worldView = mat4.lookAt(mat4.create(), vec3.fromValues(0, 0, -15), vec3.create(), vec3.fromValues(0, 1, 0));
    // mat4.invert(worldView, worldView);
    const viewClip = mat4.perspective(mat4.create(), fovY, aspectRatio, camera.front, camera.back);
    const matrices = new Matrices(worldView, viewClip);
    Object.assign(uniforms, matrices4x4(matrices), matrices3x3(matrices));
}

enum CoordSpace {
    World,
    View,
    Clip,
};

function index(from: CoordSpace, to: CoordSpace): number {
    return from * 4 + to;
}

function matrices4x4(matrices: Matrices) {
    return {
        clipViewMatrix: matrices.getMatrix(CoordSpace.Clip, CoordSpace.View),
        clipWorldMatrix: matrices.getMatrix(CoordSpace.Clip, CoordSpace.World),
        worldViewMatrix: matrices.getMatrix(CoordSpace.World, CoordSpace.View),
        worldClipMatrix: matrices.getMatrix(CoordSpace.World, CoordSpace.Clip),
        viewWorldMatrix: matrices.getMatrix(CoordSpace.View, CoordSpace.World),
        viewClipMatrix: matrices.getMatrix(CoordSpace.View, CoordSpace.Clip),
    } as const;
}

function matrices3x3(matrices: Matrices) {
    return {
        clipViewNormalMatrix: matrices.getMatrixNormal(CoordSpace.Clip, CoordSpace.View),
        clipWorldNormalMatrix: matrices.getMatrixNormal(CoordSpace.Clip, CoordSpace.World),
        worldViewNormalMatrix: matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View),
        worldClipNormalMatrix: matrices.getMatrixNormal(CoordSpace.World, CoordSpace.Clip),
        viewWorldNormalMatrix: matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World),
        viewClipNormalMatrix: matrices.getMatrixNormal(CoordSpace.View, CoordSpace.Clip),
    };
}

class Matrices implements Matrices {
    private _mtx4 = new Array<mat4 | undefined>(4 * 4);
    private _mtx3 = new Array<mat3 | undefined>(4 * 4);

    constructor(viewWorld: mat4, viewClip: mat4) {
        this._mtx4[index(CoordSpace.View, CoordSpace.World)] = viewWorld;
        this._mtx4[index(CoordSpace.View, CoordSpace.Clip)] = viewClip;
        const worldView = this._mtx4[index(CoordSpace.World, CoordSpace.View)] = mat4.create();
        const clipView = this._mtx4[index(CoordSpace.Clip, CoordSpace.View)] = mat4.create();
        mat4.invert(worldView, viewWorld);
        mat4.invert(clipView, viewClip);
    }

    getMatrix(from: CoordSpace, to: CoordSpace): mat4 {
        console.assert(from != to);
        const idx = index(from, to);
        let m = this._mtx4[idx];
        if (!m) {
            this._mtx4[idx] = m = mat4.create();
            // recursively combine from neighbor matrices
            if (to > from) {
                mat4.multiply(m, this.getMatrix(to - 1, to), this.getMatrix(from, to - 1));
            } else {
                mat4.multiply(m, this.getMatrix(from - 1, to), this.getMatrix(from, from - 1));
            }
        }
        return m;
    }

    getMatrixNormal(from: CoordSpace, to: CoordSpace): mat3 {
        console.assert(from != to);
        const idx = index(from, to);
        let m = this._mtx3[idx];
        if (!m) {
            this._mtx3[idx] = m = mat3.create();
            mat3.normalFromMat4(m, this.getMatrix(from, to));
        }
        return m;
    }
}
