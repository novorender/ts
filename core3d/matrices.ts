import { mat3, mat4, type ReadonlyMat3, type ReadonlyMat4 } from "gl-matrix";
import { CoordSpace, type Matrices, type RenderStateCamera, type RenderStateOutput } from "./state";

function index(from: CoordSpace, to: CoordSpace): number {
    return from * 3 + to;
}

/** @internal */
export function matricesFromRenderState(state: { output: RenderStateOutput; camera: RenderStateCamera; }): Matrices {
    const { camera, output } = state;
    const { width, height, webgpu } = output;
    const aspectRatio = width / height;
    const fovY = camera.fov * Math.PI / 180;
    let viewWorld = mat4.fromRotationTranslation(mat4.create(), camera.rotation, camera.position);
    let viewClip = mat4.create();
    if (camera.kind == "orthographic") {
        const aspect = output.width / output.height;
        const halfHeight = camera.fov / 2;
        const halfWidth = halfHeight * aspect;
        if(webgpu) {
            mat4.orthoZO(viewClip, -halfWidth, halfWidth, -halfHeight, halfHeight, camera.near, camera.far);
        }else{
            mat4.ortho(viewClip, -halfWidth, halfWidth, -halfHeight, halfHeight, camera.near, camera.far);
        }
    } else {
        if(webgpu) {
            mat4.perspectiveZO(viewClip, fovY, aspectRatio, camera.near, camera.far);
        }else{
            mat4.perspective(viewClip, fovY, aspectRatio, camera.near, camera.far);
        }

    }
    return new MatricesImpl(viewWorld, viewClip);
}

class MatricesImpl implements Matrices {
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

    getMatrix(from: CoordSpace, to: CoordSpace): ReadonlyMat4 {
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

    getMatrixNormal(from: CoordSpace, to: CoordSpace): ReadonlyMat3 {
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
