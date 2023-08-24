import { mat3, mat4, glMatrix, type ReadonlyMat4, vec3 } from "gl-matrix";
import { Ray } from "./ray";

glMatrix.setMatrixArrayType(Array);

export interface CameraData {
    readonly viewWorldMatrix: ReadonlyMat4;
    readonly pixelSize: number;
}

export class Camera {
    readonly viewWorldMatrix: ReadonlyMat4;
    readonly viewWorldMatrixNormal = mat3.create();
    readonly worldViewMatrix = mat4.create();
    // readonly worldViewMatrixNormal = mat3.create();
    readonly pixelSize: number;

    constructor(data: CameraData) {
        this.viewWorldMatrix = data.viewWorldMatrix;
        this.pixelSize = data.pixelSize;
        mat3.normalFromMat4(this.viewWorldMatrixNormal, data.viewWorldMatrix);
        mat4.invert(this.worldViewMatrix, data.viewWorldMatrix);
        // mat3.normalFromMat4(this.worldViewMatrixNormal, this.worldViewMatrix);
    }

    get data(): CameraData {
        const { viewWorldMatrix, pixelSize } = this;
        return { viewWorldMatrix, pixelSize };
    }

    get backward() {
        const m = this.viewWorldMatrix;
        const v = vec3.fromValues(m[8], m[9], m[10]);
        vec3.normalize(v, v);
        return v;
    }

    get scaleTransform() {
        const s = 0.5 / this.pixelSize;
        const m = new DOMMatrix();
        m.scaleSelf(s, s);
        return m;
    }

    // x and y are pixel offsets from center of viewport.
    emitRay(x: number, y: number): Ray {
        const { pixelSize, viewWorldMatrix: worldViewMatrix, viewWorldMatrixNormal: worldViewMatrixNormal } = this;
        const origin = vec3.fromValues(x * pixelSize, y * pixelSize, 0);
        const direction = vec3.fromValues(0, 0, -1);
        vec3.transformMat4(origin, origin, worldViewMatrix);
        vec3.transformMat3(direction, direction, worldViewMatrixNormal);
        return new Ray(origin, direction);
    }
}
