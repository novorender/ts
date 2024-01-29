import { glMatrix, mat3, mat4, vec2, vec3 } from "gl-matrix";
import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import { makeNurbsCurve2D, makeNurbsCurve3D } from "./nurbs";
import { closestPointToLine, getProfile } from "./util";
glMatrix.setMatrixArrayType(Array);

type CurveKind = "line" | "arc" | "nurbs" | "lineStrip";

// TODO: Use 2D p-curves?
// TODO: Triangulate (delauney) p-space?
// or even tetrahedron tesselation of 3D face?

export interface LineSegment3D {
    dir: vec3;
    start: vec3;
    end: vec3;
}

export function lineToSegment(line: Line3D, mat: mat4): LineSegment3D {
    const start = vec3.create();
    const end = vec3.create();
    const dir = vec3.create();
    line.eval(line.beginParam, start, dir);
    line.eval(line.endParam, end, undefined);
    vec3.transformMat4(start, start, mat);
    vec3.transformMat4(end, end, mat);

    const normalMat = mat3.normalFromMat4(mat3.create(), mat);
    vec3.transformMat3(dir, dir, normalMat);
    vec3.normalize(dir, dir);
    return { dir, start, end };
}

export class DisposableCurve {
    dispose(): void { }
}

export interface Curve3D {
    readonly kind: CurveKind;
    tesselationParameters: readonly number[];
    sense: number;
    // eval(position: vec2, t: number): void;
    eval(t: number, point: vec3 | undefined, tangent: vec3 | undefined): void;
    // project(pos: ReadonlyVec3): number;
    invert(pos: ReadonlyVec3): number;
    // signedDistance(point: ReadonlyVec2): number; // signed distance from point to curve (along x/u axis?)
    // intersectCount(point: ReadonlyVec2): number;
}

export interface Curve2D {
    readonly kind: CurveKind;
    readonly beginParam: number;
    readonly endParam: number;
    // eval(position: vec2, t: number): void;
    eval(t: number, point: vec2 | undefined, tangent: vec2 | undefined): void;
    project(pos: ReadonlyVec2): number;
    // invert(pos: ReadonlyVec2): number;
    // signedDistance(point: ReadonlyVec2): number; // signed distance from point to curve (along x/u axis?)
    // intersectCount(point: ReadonlyVec2): number;
}

/*

foreach curve
  if ray intersects curve
    count++

visible = (count % 2) == 1

*/

export class LineStrip3D implements Curve3D {
    readonly kind = "lineStrip";
    readonly sense = 1;
    constructor(
        readonly vertices: ReadonlyVec3[],
        readonly beginParam: number,
        readonly endParam: number,
        readonly tesselationParameters: readonly number[]
    ) { }
    eval(t: number, point: vec3 | undefined, tangent: vec3 | undefined): void {
        const { vertices, endParam, beginParam, tesselationParameters } = this;
        let segIndex = 0;
        if (t >= endParam) {
            segIndex = tesselationParameters.length - 1;
        } else if (t <= beginParam) {
            segIndex = 0;
        } else {
            while (t < endParam && segIndex < tesselationParameters.length - 1) {
                if (t < tesselationParameters[segIndex + 1]) {
                    break;
                }
                ++segIndex;
            }
        }

        const start = vertices[segIndex];
        const dir =
            segIndex < vertices.length - 1
                ? vec3.subtract(vec3.create(), vertices[segIndex + 1], start)
                : vec3.subtract(vec3.create(), start, vertices[segIndex - 1]);
        vec3.normalize(dir, dir);
        if (point) {
            const segStartParam = tesselationParameters[segIndex];
            const localParam = t - segStartParam;
            vec3.scale(point, dir, localParam);
            vec3.add(point, point, start);
        }
        if (tangent) {
            vec3.copy(tangent, dir);
        }
    }
    invert(pos: ReadonlyVec3): number {
        const { vertices, tesselationParameters } = this;
        let smallestDist = Number.MAX_VALUE;
        let closestParameter = 0;
        for (let i = 0; i < vertices.length - 1; ++i) {
            const p = closestPointToLine(pos, vertices[i], vertices[i + 1]);
            const dist = vec3.dist(p.pos, pos);
            if (dist < smallestDist) {
                smallestDist = dist;
                const segLength =
                    tesselationParameters[i + 1] - tesselationParameters[i];
                closestParameter = tesselationParameters[i] + segLength * p.parameter;
            }
        }
        return closestParameter;
    }

    toSegments(transform: mat4): LineSegment3D[] {
        const { vertices, tesselationParameters } = this;
        const segments: LineSegment3D[] = [];
        for (let i = 1; i < tesselationParameters.length; ++i) {
            const start = vec3.transformMat4(
                vec3.create(),
                vertices[i - 1],
                transform
            );
            const end = vec3.transformMat4(vec3.create(), vertices[i], transform);
            const dir = vec3.sub(vec3.create(), end, start);
            vec3.normalize(dir, dir);
            segments.push({ start, end, dir });
        }
        return segments;
    }
    toProfile(transform: mat4): ReadonlyVec2[] {
        const { vertices, tesselationParameters } = this;
        return getProfile(vertices, tesselationParameters, transform);
    }
}

export class Line3D extends DisposableCurve implements Curve3D {
    readonly kind = "line";

    constructor(
        readonly origin: ReadonlyVec3,
        readonly direction: ReadonlyVec3,
        readonly beginParam: number,
        readonly endParam: number,
        readonly sense: -1 | 1,
        readonly tesselationParameters: readonly number[]
    ) {
        super();
    }

    eval(t: number, point: vec3 | undefined, tangent: vec3 | undefined) {
        const { origin, direction, sense, beginParam, endParam } = this;
        if (point) {
            vec3.scale(point, direction, t);
            vec3.add(point, point, origin);
        }
        if (tangent) {
            if (sense > 0) vec3.copy(tangent, direction);
            else vec3.negate(tangent, direction);
        }
    }
    invert(pos: ReadonlyVec3) {
        const start = vec3.create();
        this.eval(this.beginParam, start, undefined);
        const end = vec3.create();
        this.eval(this.endParam, end, undefined);

        const len = vec3.dist(start, end);
        const pointToStart = vec3.create();
        vec3.subtract(pointToStart, pos, start);

        const distAlongLine = vec3.dot(this.direction, pointToStart);
        const fraction = distAlongLine / len;
        return this.beginParam + (this.endParam - this.beginParam) * fraction;
    }
}

export class Arc3D extends DisposableCurve implements Curve3D {
    readonly kind = "arc";
    readonly tmp = vec3.create();

    constructor(
        readonly origin: ReadonlyVec3,
        readonly axisX: ReadonlyVec3,
        readonly axisY: ReadonlyVec3,
        readonly radius: number,
        readonly beginParam: number,
        readonly endParam: number,
        readonly sense: -1 | 1,
        readonly tesselationParameters: readonly number[]
    ) {
        super();
    }

    eval(t: number, point: vec3 | undefined, tangent: vec3 | undefined) {
        const { sense } = this;
        const x = Math.cos(t);
        const y = Math.sin(t);
        if (point) {
            const { origin, radius, axisX, axisY, tmp } = this;
            vec3.scale(tmp, axisX, x * radius);
            vec3.add(point, origin, tmp);
            vec3.scale(tmp, axisY, y * radius);
            vec3.add(point, point, tmp);
        }
        if (tangent) {
            const { axisX, axisY, tmp } = this;
            vec3.scale(tangent, axisX, x * sense);
            vec3.scale(tmp, axisY, -y * sense);
            vec3.add(tangent, tmp, tangent);
        }
    }

    invert(pos: ReadonlyVec3) {
        const a = pointAtAngle(pos, this);
        if (a > this.endParam || a < this.beginParam) {
            let disEnd = a - this.endParam;
            if (disEnd < 0) {
                disEnd += 2 * Math.PI;
            }
            let disStart = this.beginParam - a;
            if (disStart < 0) {
                disStart += 2 * Math.PI;
            }
            if (disEnd < disStart) {
                return this.endParam;
            }
            return this.beginParam;
        }
        return a;
    }
}

export function pointAtAngle(point: ReadonlyVec3, arc3d: Arc3D) {
    const planeNormal = vec3.cross(vec3.create(), arc3d.axisX, arc3d.axisY);
    const p = vec3.sub(vec3.create(), point, arc3d.origin);
    const d = vec3.dot(p, planeNormal);
    const projectedPoint = vec3.scaleAndAdd(
        vec3.create(),
        point,
        planeNormal,
        -d
    );
    const dir = vec3.sub(vec3.create(), projectedPoint, arc3d.origin);
    vec3.normalize(dir, dir);
    const pointOnArc = vec3.scaleAndAdd(
        vec3.create(),
        arc3d.origin,
        dir,
        arc3d.radius
    );
    vec3.sub(pointOnArc, pointOnArc, arc3d.origin);
    const x = vec3.dot(pointOnArc, arc3d.axisX);
    const y = vec3.dot(pointOnArc, arc3d.axisY);
    let a = Math.atan2(y, x);
    if (a < 0) {
        a += 2 * Math.PI;
    }
    return a;
}

type Pointer = number;

export class NurbsCurve3D extends DisposableCurve implements Curve3D {
    readonly kind = "nurbs";
    ptr: Pointer = 0;

    constructor(
        readonly order: number,
        readonly controlPoints: ReadonlyVec3[],
        readonly knots: number[],
        readonly weights: number[] | undefined,
        readonly beginParam: number,
        readonly endParam: number,
        readonly sense: -1 | 1,
        readonly tesselationParameters: readonly number[],
        private readonly wasmInstance: any,
        private readonly buffer: Float64Array
    ) {
        super();
    }

    dispose() {
        if (this.weights) {
            this.wasmInstance._disposeNurbsCurve3DWithWeights(this.ptr);
        } else {
            this.wasmInstance._disposeNurbsCurve3D(this.ptr);
        }
    }

    eval(t: number, point: vec3 | undefined, tangent: vec3 | undefined) {
        if (this.ptr === 0) {
            this.ptr = makeNurbsCurve3D(
                this.wasmInstance,
                this.knots,
                this.controlPoints,
                this.weights,
                this.order
            );
        }
        if (this.weights) {
            this.wasmInstance._evalNurbsCurve3DWithWeights(
                this.ptr,
                t,
                point ? this.buffer.byteOffset : undefined,
                tangent ? this.buffer.byteOffset + 24 : undefined
            );
        } else {
            this.wasmInstance._evalNurbsCurve3D(
                this.ptr,
                t,
                point ? this.buffer.byteOffset : undefined,
                tangent ? this.buffer.byteOffset + 24 : undefined
            );
        }
        if (point != undefined) {
            const [x, y, z] = this.buffer.subarray(0, 3);
            vec3.set(point, x, y, z);
        }
        if (tangent != undefined) {
            const [x, y, z] = this.buffer.subarray(3, 6);
            vec3.set(tangent, x, y, z);
        }
    }

    invert(point: ReadonlyVec3) {
        if (this.ptr === 0) {
            const ctrlPt2d = this.controlPoints.map((p) =>
                vec2.fromValues(p[0] / Math.PI, p[1] / 500)
            );
            this.ptr = makeNurbsCurve2D(
                this.wasmInstance,
                this.knots,
                ctrlPt2d,
                this.weights,
                this.order
            );
        }
        return this.wasmInstance._invertNurbsCurve3D(
            this.ptr,
            point[0],
            point[1],
            point[2]
        );
    }
}

export class Line2D extends DisposableCurve implements Curve2D {
    readonly kind = "line";

    constructor(
        readonly origin: ReadonlyVec2,
        readonly direction: ReadonlyVec2,
        readonly beginParam: number,
        readonly endParam: number,
        readonly sense: -1 | 1
    ) {
        super();
    }

    eval(t: number, point: vec2 | undefined, tangent: vec2 | undefined) {
        const { origin, direction } = this;
        if (point) {
            vec2.scale(point, direction, t);
            vec2.add(point, point, origin);
        }
        if (tangent) {
            if (this.sense > 0) {
                vec2.copy(tangent, direction);
            } else {
                vec2.negate(tangent, direction);
            }
        }
    }

    project(point: ReadonlyVec2): number {
        const [x, y] = point;
        const { origin, direction, beginParam, endParam } = this;
        const dx = x - origin[0];
        const dy = y - origin[1];
        let t = dx * direction[0] + dy * direction[1]; // dot product yields projection parameter
        // clamp to range
        const centerParam = (beginParam + endParam) / 2;
        const extent = Math.abs(endParam - beginParam) / 2;
        const minParam = centerParam - extent;
        const maxParam = centerParam + extent;
        t = Math.max(minParam, Math.min(maxParam, t));
        return t;
        // // find projected point
        // const px = origin[0] + direction[0] * t;
        // const py = origin[1] - direction[1] * t;
        // const pdx = x - px;
        // const pdy = y - py;
        // return pdy * direction[0] - pdx * direction[1]; // cross product yields signed distance from line
    }

    // intersectCount(point: ReadonlyVec2) {
    //     const [x, y] = point;
    //     if (x > this.minX && y >= this.minY && y < this.maxY) {
    //         const { begin, end } = this;
    //         const t = (y - begin[1]) / (end[1] - begin[1]);
    //         const lx = begin[0] + this.deltaX * t;
    //         if (x > lx) {
    //             return 1;
    //         }
    //     }
    //     return 0;
    // }
}

export class NurbsCurve2D extends DisposableCurve implements Curve2D {
    readonly kind = "nurbs";
    ptr: Pointer = 0;

    constructor(
        readonly order: number,
        readonly controlPoints: ReadonlyVec2[],
        readonly knots: number[],
        readonly weights: number[] | undefined,
        readonly beginParam: number,
        readonly endParam: number,
        readonly sense: -1 | 1,
        private readonly wasmInstance: any,
        private readonly buffer: Float64Array
    ) {
        super();
    }

    eval(t: number, point: vec2 | undefined, tangent: vec2 | undefined) {
        if (this.ptr === 0) {
            const ctrlPt2d = this.controlPoints.map((p) =>
                vec2.fromValues(p[0] / Math.PI, p[1] / 500)
            );
            this.ptr = makeNurbsCurve2D(
                this.wasmInstance,
                this.knots,
                ctrlPt2d,
                this.weights,
                this.order
            );
        }
        if (this.weights) {
            this.wasmInstance._evalNurbsCurve2DWithWeights(
                this.ptr,
                t,
                point ? this.buffer.byteOffset : undefined,
                tangent ? this.buffer.byteOffset + 24 : undefined
            );
        } else {
            this.wasmInstance._evalNurbsCurve2D(
                this.ptr,
                t,
                point ? this.buffer.byteOffset : undefined,
                tangent ? this.buffer.byteOffset + 24 : undefined
            );
        }
        if (point != undefined) {
            const [x, y] = this.buffer.subarray(0, 2);
            vec2.set(point, x, y);
        }
        if (tangent != undefined) {
            const [x, y] = this.buffer.subarray(3, 5);
            vec2.set(tangent, x, y);
        }
    }

    project(point: ReadonlyVec2): number {
        if (this.ptr === 0) {
            const ctrlPt2d = this.controlPoints.map((p) =>
                vec2.fromValues(p[0] / Math.PI, p[1] / 500)
            );
            this.ptr = makeNurbsCurve2D(
                this.wasmInstance,
                this.knots,
                ctrlPt2d,
                this.weights,
                this.order
            );
        }
        return this.wasmInstance._projectNurbsCurve2D(this.ptr, point[0], point[1]);
    }

    dispose() {
        if (this.weights) {
            this.wasmInstance._disposeNurbsCurve2DWithWeights(this.ptr);
        } else {
            this.wasmInstance._disposeNurbsCurve2D(this.ptr);
        }
    }
}

const pi2 = Math.PI * 2;

export class Arc2D implements Curve2D {
    readonly kind = "arc";

    constructor(
        readonly origin: ReadonlyVec2,
        readonly radius: number,
        readonly beginParam: number,
        readonly endParam: number,
        readonly sense: 1 | -1
    ) { }

    eval(t: number, point: vec2 | undefined, tangent: vec2 | undefined) {
        const x = Math.cos(t);
        const y = Math.sin(t);
        if (point) {
            const { origin, radius } = this;
            point[0] = x * radius + origin[0];
            point[1] = y * radius + origin[1];
        }
        if (tangent) {
            const { sense } = this;
            tangent[0] = -y * sense;
            tangent[1] = x * sense;
        }
    }

    project(point: ReadonlyVec2): number {
        const [x, y] = point;
        const { origin, beginParam, endParam } = this;
        let t = Math.atan2(y - origin[1], x - origin[0]);
        if (t < 0) t += pi2;
        // clamp to range
        const centerParam = (beginParam + endParam) / 2;
        const extent = Math.abs(endParam - beginParam) / 2;
        const minParam = centerParam - extent;
        const maxParam = centerParam + extent;
        while (t < centerParam - Math.PI) t += pi2;
        while (t > centerParam + Math.PI) t -= pi2;
        t = Math.max(minParam, Math.min(maxParam, t));

        return t;
    }

    // isVectorInParamRange(x: number, y: number) {
    //     return x * this.rangeVec[0] + y * this.rangeVec[1] >= this.rangeCos;
    // }

    // intersectCount(point: ReadonlyVec2) {
    //     const [x, y] = point;
    //     const { origin, radius } = this;
    //     let cnt = 0;
    //     if (y >= this.minY && y < this.maxY) {
    //         const uy = Math.min(1, (y - origin[1]) / radius);
    //         const ux = Math.sqrt(1 - uy * uy);
    //         // is point right of origin?
    //         if (x > origin[0]) {
    //             if (this.isVectorInParamRange(ux, uy) && x > ux) {
    //                 cnt++;
    //             }
    //         }
    //         if (x > origin[0] - radius) {
    //             if (this.isVectorInParamRange(-ux, uy) && x > -ux) {
    //                 cnt++;
    //             }
    //         }

    //     }
    //     return cnt;
    // }
}
