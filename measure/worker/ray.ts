import { glMatrix, vec3 } from "gl-matrix";
import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
glMatrix.setMatrixArrayType(Array);

const tmp3 = vec3.create();

export class Ray {
    constructor(readonly origin: ReadonlyVec3, readonly direction: ReadonlyVec3) { }

    eval(pointOut: vec3, t: number) {
        vec3.scale(pointOut, this.direction, t);
        vec3.add(pointOut, pointOut, this.origin);
    }

    invert(point: ReadonlyVec3): number {
        vec3.sub(tmp3, point, this.origin);
        return vec3.dot(tmp3, this.direction);
    }
}

export interface Intersection {
    readonly distance: number;
    readonly uv: ReadonlyVec2;
}
