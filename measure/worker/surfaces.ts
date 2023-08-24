import type { ReadonlyMat3, ReadonlyMat4, ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import { glMatrix, mat3, mat4, vec2, vec3 } from "gl-matrix";
import { makeNurbsSurface } from "./nurbs";
import { Ray } from "./ray";

type SurfaceKind = "plane" | "sphere" | "cylinder" | "cone" | "torus" | "nurbs";
glMatrix.setMatrixArrayType(Array);

export interface Surface {
    readonly kind: SurfaceKind;
    readonly sense: -1 | 1;
    evalPosition(positionOut: vec3, uv: ReadonlyVec2): void;
    evalNormal(normalOut: vec3, uv: ReadonlyVec2): void;
    invert(uvOut: vec2, pos: ReadonlyVec3): void;
    intersect(uvOut: vec2, ray: Ray): boolean;
}

const tmp3 = vec3.create();
const origin = vec3.create();
const direction = vec3.create();
const unitRay = new Ray(origin, direction);

// solution: 0 = smallest, 1 = largest
function solveQuadraticPolynomial(a: number, b: number, c: number, solution: 0 | 1 = 0) {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0 || a == 0) return undefined;
    const sign = Math.sign(a) * solution ? 1 : -1;
    // const s0 = (-b - Math.sqrt(discriminant)) / (2 * a);
    // const s1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    // if (s0 == s1) console.log(s0);
    return (-b + sign * Math.sqrt(discriminant)) / (2 * a);
}

function combineMatrices(m0: ReadonlyMat4 | undefined, m1: mat4 | undefined): ReadonlyMat4 | undefined {
    if (m0 && !m1) return m0;
    else if (!m0 && m1) return m1;
    else if (m0 && m1) {
        return mat4.multiply(m1, m0, m1);
        // return mat4.multiply(m1, m1, m0);
    }
}

function unitSphereMatrix(radius: number): mat4 | undefined {
    if (radius == 1) return undefined;
    const m = mat4.create();
    mat4.fromScaling(m, vec3.fromValues(radius, radius, radius));
    return m;
}

function unitCylinderMatrix(radius: number): mat4 | undefined {
    if (radius == 1) return undefined;
    const m = mat4.create();
    mat4.fromScaling(m, vec3.fromValues(radius, radius, 1));
    return m;
}

export abstract class UnitSurface implements Surface {
    // Scale from mm to meters. Applied on functions that deal with 3D coordinate (which should be in meters), such as evalPos, invert and intersect. UV coords are still in mm since open cascade uses that unit internally and conversion is non-trivial.
    private readonly surfaceToObjectSpaceTransform: ReadonlyMat4;
    private readonly objectToSurfaceSpaceTransform: ReadonlyMat4;
    private readonly surfaceToObjectSpaceTransformNormal: ReadonlyMat3;
    private readonly objectToSurfaceSpaceTransformNormal: ReadonlyMat3;

    constructor(readonly kind: SurfaceKind, surfaceToObjectSpaceTransform: ReadonlyMat4 | undefined, readonly sense: -1 | 1, readonly scale: number) {
        const transform = surfaceToObjectSpaceTransform ? mat4.clone(surfaceToObjectSpaceTransform) : mat4.create();
        const scaleMat = mat4.fromScaling(mat4.create(), vec3.fromValues(this.scale, this.scale, this.scale));
        mat4.multiply(transform, scaleMat, transform);
        this.surfaceToObjectSpaceTransform = transform;
        const objectToSurfaceSpaceTransform = mat4.invert(mat4.create(), this.surfaceToObjectSpaceTransform);
        this.objectToSurfaceSpaceTransform = objectToSurfaceSpaceTransform;
        let surfaceToObjectSpaceTransformNormal = mat3.fromMat4(mat3.create(), this.surfaceToObjectSpaceTransform);
        // mat3.normalFromMat4(surfaceToObjectSpaceTransformNormal, this.surfaceToObjectSpaceTransform)
        this.surfaceToObjectSpaceTransformNormal = surfaceToObjectSpaceTransformNormal;
        const objectToSurfaceSpaceTransformNormal = mat3.fromMat4(mat3.create(), this.objectToSurfaceSpaceTransform);
        // mat3.normalFromMat4(objectToSurfaceSpaceTransformNormal, this.objectToSurfaceSpaceTransform)
        this.objectToSurfaceSpaceTransformNormal = objectToSurfaceSpaceTransformNormal;
    }

    evalPosition(positionOut: vec3, uv: ReadonlyVec2) {
        this.unitEvalPosition(positionOut, uv);
        vec3.transformMat4(positionOut, positionOut, this.surfaceToObjectSpaceTransform);
    }

    evalNormal(normalOut: vec3, uv: ReadonlyVec2) {
        this.unitEvalNormal(normalOut, uv);
        vec3.scale(normalOut, normalOut, this.sense);
        vec3.transformMat3(normalOut, normalOut, this.surfaceToObjectSpaceTransformNormal);
        vec3.normalize(normalOut, normalOut);
    }

    invert(uvOut: vec2, point: ReadonlyVec3) {
        vec3.transformMat4(tmp3, point, this.objectToSurfaceSpaceTransform);
        this.unitInvert(uvOut, tmp3);
    }

    intersect(uvOut: vec2, ray: Ray): boolean {
        vec3.transformMat4(origin, ray.origin, this.objectToSurfaceSpaceTransform);
        vec3.transformMat3(direction, ray.direction, this.objectToSurfaceSpaceTransformNormal); // it's okay of direction isn't a normal (length=1)
        const t = this.unitIntersect(unitRay);
        if (!t) return false;
        unitRay.eval(tmp3, t);
        this.unitInvert(uvOut, tmp3);
        return true;
    }

    dispose(): void { }

    protected abstract unitEvalPosition(positionOut: vec3, uv: ReadonlyVec2): void;
    protected abstract unitEvalNormal(normalOut: vec3, uv: ReadonlyVec2): void;
    protected abstract unitInvert(uvOut: vec2, point: ReadonlyVec3): void;
    protected abstract unitIntersect(ray: Ray): number | undefined;
}

export class Plane extends UnitSurface {
    constructor(surfaceToObjectSpaceTransform?: ReadonlyMat4, sense: -1 | 1 = 1, scale?: number) {
        super("plane", surfaceToObjectSpaceTransform, sense, scale ?? 1);
    }

    unitEvalPosition(positionOut: vec3, uv: ReadonlyVec2) {
        vec3.set(positionOut, uv[0], uv[1], 0);
    }

    unitEvalNormal(normalOut: vec3, uv: ReadonlyVec2 | undefined) {
        vec3.set(normalOut, 0, 0, 1);
    }

    unitInvert(uvOut: vec2, point: ReadonlyVec3) {
        return vec2.set(uvOut, point[0], point[1]);
    }

    unitIntersect(ray: Ray): number | undefined {
        if (ray.direction[2] * this.sense < 0) {
            // only intersect forward facing planes
            const t = -ray.origin[2] / ray.direction[2];
            return t;
        }
    }
}

export class Sphere extends UnitSurface {
    constructor(readonly radius = 1, surfaceToObjectSpaceTransform?: ReadonlyMat4, sense: -1 | 1 = 1, scale?: number) {
        super("sphere", combineMatrices(surfaceToObjectSpaceTransform, unitSphereMatrix(radius)), sense, scale ?? 1);
    }

    unitEvalPosition(positionOut: vec3, uv: ReadonlyVec2) {
        const s = Math.cos(uv[1]);
        vec3.set(positionOut, Math.cos(uv[0]) * s, Math.sin(uv[0]) * s, Math.sin(uv[1]));
    }

    unitEvalNormal(normalOut: vec3, uv: ReadonlyVec2) {
        const s = Math.cos(uv[1]);
        vec3.set(normalOut, Math.cos(uv[0]) * s, Math.sin(uv[0]) * s, Math.sin(uv[1]));
    }

    unitInvert(uvOut: vec2, point: ReadonlyVec3) {
        vec2.set(uvOut, Math.atan2(point[1], point[0]), Math.asin(Math.max(-1, Math.min(1, point[2]))));
    }

    unitIntersect(ray: Ray) {
        const { origin, direction } = ray;
        const [x0, y0, z0] = origin;
        const [dx, dy, dz] = direction;

        const a = dx * dx + dy * dy + dz * dz;
        const b = 2 * (x0 * dx + y0 * dy + z0 * dz);
        const c = x0 * x0 + y0 * y0 + z0 * z0 - 1;
        const t = solveQuadraticPolynomial(a, b, c, this.sense > 0 ? 0 : 1);
        return t;
    }
}

export class Cylinder extends UnitSurface {
    constructor(readonly radius = 1, surfaceToObjectSpaceTransform?: ReadonlyMat4, sense: -1 | 1 = 1, scale?: number) {
        super("cylinder", combineMatrices(surfaceToObjectSpaceTransform, unitCylinderMatrix(radius)), (sense * matrixInversion(surfaceToObjectSpaceTransform)) as -1 | 1, scale ?? 1);
    }

    unitEvalPosition(positionOut: vec3, uv: ReadonlyVec2) {
        vec3.set(positionOut, Math.cos(uv[0]), Math.sin(uv[0]), uv[1]);
    }

    unitEvalNormal(normalOut: vec3, uv: ReadonlyVec2) {
        vec3.set(normalOut, Math.cos(uv[0]), Math.sin(uv[0]), 0);
    }

    unitInvert(uvOut: vec2, point: ReadonlyVec3) {
        const [x, y, z] = point;
        let u = Math.atan2(y, x);
        if (u < 0) u += Math.PI * 2;
        vec2.set(uvOut, u, z);
    }

    unitIntersect(ray: Ray) {
        const { origin, direction } = ray;
        const [x0, y0] = origin;
        const [dx, dy] = direction;
        const a = dx * dx + dy * dy;
        const b = 2 * (x0 * dx + y0 * dy);
        const c = x0 * x0 + y0 * y0 - 1;
        const t = solveQuadraticPolynomial(a, b, c, this.sense > 0 ? 0 : 1);
        return t;
    }
}

function unitConeMatrix(halfAngleTan: number, radius: number): mat4 | undefined {
    if (halfAngleTan == 1) return undefined;
    const scaleXY = 1; // Math.abs(halfAngleTan);
    const scaleZ = 1 / halfAngleTan; // Math.sign(halfAngleTan); //Math.cos(Math.atan(halfAngleTan));
    const s = mat4.create();
    const t = mat4.create();
    const m = mat4.create();
    // z = (z + radius) / halfAngleTan;
    mat4.fromTranslation(t, vec3.fromValues(0, 0, radius * Math.sign(halfAngleTan)));
    mat4.fromScaling(s, vec3.fromValues(scaleXY, scaleXY, scaleZ));
    mat4.multiply(m, s, t);
    return m;
}

function matrixInversion(m?: ReadonlyMat4): 1 | -1 {
    if (!m) return 1;

    const [e00, e01, e02, e03, e10, e11, e12, e13, e20, e21, e22, e23, e30, e31, e32, e33] = m;
    const x = vec3.fromValues(e00, e10, e20);
    const y = vec3.fromValues(e01, e11, e21);
    const z = vec3.fromValues(e02, e12, e22);
    const cp = vec3.create();
    vec3.cross(cp, x, y);
    const dp = vec3.dot(cp, z);
    return dp >= 0 ? 1 : -1;
}

export class Cone extends UnitSurface {
    readonly scaleV;
    // readonly offsetV;

    constructor(readonly radius = 1, readonly halfAngleTan = -1, surfaceToObjectSpaceTransform?: ReadonlyMat4, sense: -1 | 1 = 1, scale?: number) {
        super("cone", combineMatrices(surfaceToObjectSpaceTransform, unitConeMatrix(halfAngleTan, radius)), (sense * matrixInversion(surfaceToObjectSpaceTransform)) as -1 | 1, scale ?? 1);
        this.scaleV = halfAngleTan * Math.cos(Math.atan(halfAngleTan));
    }

    unitEvalPosition(positionOut: vec3, uv: ReadonlyVec2) {
        let [u, v] = uv;
        v = v * this.scaleV + this.radius; // / Math.abs(this.halfAngleTan);
        vec3.set(positionOut, Math.cos(u) * v, Math.sin(u) * v, v);
    }

    unitEvalNormal(normalOut: vec3, uv: ReadonlyVec2) {
        const [u, v] = uv;
        const s = Math.sqrt(0.5);
        vec3.set(normalOut, Math.cos(u) * s, Math.sin(u) * s, -s);
    }

    unitInvert(uvOut: vec2, point: ReadonlyVec3) {
        const [x, y, z] = point;
        let u = Math.atan2(y, x);
        if (u < 0) u += Math.PI * 2;
        const v = (z - this.radius) / this.scaleV;
        vec2.set(uvOut, u, v);
    }

    unitIntersect(ray: Ray) {
        const { origin, direction } = ray;
        const [x0, y0, z0] = origin;
        const [dx, dy, dz] = direction;
        const a = dx * dx + dy * dy - dz * dz;
        const b = 2 * (x0 * dx + y0 * dy - z0 * dz);
        const c = x0 * x0 + y0 * y0 - z0 * z0;
        // const t = solveQuadraticPolynomial(a, b, c, 0); // perhaps just give the hit that faces the ray?
        const t = solveQuadraticPolynomial(a, b, c, this.sense > 0 ? 0 : 1); // perhaps just give the hit that faces the ray?
        return t;
    }
}

export class Torus extends UnitSurface {
    constructor(readonly majorRadius = 1, readonly minorRadius = 0.5, surfaceToObjectSpaceTransform?: ReadonlyMat4, sense: -1 | 1 = 1, scale?: number) {
        super("torus", surfaceToObjectSpaceTransform, sense, scale ?? 1);
    }

    unitEvalPosition(positionOut: vec3, uv: ReadonlyVec2) {
        const [u, v] = uv;
        const { majorRadius, minorRadius } = this;
        const r = majorRadius + Math.cos(v) * minorRadius;
        vec3.set(positionOut, Math.cos(u) * r, Math.sin(u) * r, Math.sin(v) * minorRadius);
    }

    unitEvalNormal(normalOut: vec3, uv: ReadonlyVec2) {
        const [u, v] = uv;
        vec3.set(normalOut, Math.cos(u) * Math.cos(v), Math.sin(u) * Math.cos(v), Math.sin(v));
    }

    unitInvert(uvOut: vec2, point: ReadonlyVec3) {
        const [x, y, z] = point;
        let u = Math.atan2(y, x);
        if (u < 0) u += Math.PI * 2;
        let v = Math.atan2(z, Math.sqrt(x * x + y * y) - this.majorRadius);
        if (v < 0) v += Math.PI * 2;
        vec2.set(uvOut, u, v);
    }

    unitIntersect(ray: Ray) {
        // TODO: handle inverted torus
        return intersectTorus(ray, this.majorRadius, this.minorRadius);
    }
}

type Pointer = number;

export class Nurbs extends UnitSurface {
    readonly kind = "nurbs";
    ptr: Pointer = 0;
    constructor(readonly orders: [number, number], readonly dim: [number, number], readonly controlPoints: ReadonlyVec3[], readonly knots: number[], readonly weights: number[] | undefined, readonly sense: -1 | 1, private readonly wasmInstance: any, private readonly buffer: Float64Array, scale?: number) {
        super("nurbs", undefined, sense, scale ?? 1);
    }

    dispose() {
        if (this.weights) {
            this.wasmInstance._disposeNurbsSurface(this.ptr);
        } else {
            this.wasmInstance._disposeNurbsSurfaceWithWeights(this.ptr);
        }
    }

    unitEvalPosition(positionOut: vec3, uv: ReadonlyVec2) {
        if (this.ptr === 0) {
            this.ptr = makeNurbsSurface(this.wasmInstance, this.knots, this.dim[0], this.dim[1], this.controlPoints, this.weights, this.orders[0], this.orders[1]);
        }
        if (this.weights) {
            this.wasmInstance._evalNurbsSurfaceWithWeights(this.ptr, uv[0], uv[1], this.buffer.byteOffset, undefined);
        } else {
            this.wasmInstance._evalNurbsSurface(this.ptr, uv[0], uv[1], this.buffer.byteOffset, undefined);
        }
        const [x, y, z] = this.buffer.subarray(0, 3);
        vec3.set(positionOut, x, y, z);
    }

    unitEvalNormal(normalOut: vec3, uv: ReadonlyVec2) {
        if (this.ptr === 0) {
            this.ptr = makeNurbsSurface(this.wasmInstance, this.knots, this.dim[0], this.dim[1], this.controlPoints, this.weights, this.orders[0], this.orders[1]);
        }
        if (this.weights) {
            this.wasmInstance._evalNurbsSurfaceWithWeights(this.ptr, uv[0], uv[1], undefined, this.buffer.byteOffset + 24);
        } else {
            this.wasmInstance._evalNurbsSurface(this.ptr, uv[0], uv[1], undefined, this.buffer.byteOffset + 24);
        }
        const [x, y, z] = this.buffer.subarray(3, 6);
        vec3.set(normalOut, -x, -y, -z);
    }

    unitInvert(uvOut: vec2, pos: ReadonlyVec3) {
        if (this.ptr === 0) {
            this.ptr = makeNurbsSurface(this.wasmInstance, this.knots, this.dim[0], this.dim[1], this.controlPoints, this.weights, this.orders[0], this.orders[1]);
        }
        this.wasmInstance._invertSurface(this.ptr, pos[0], pos[1], pos[2], this.buffer.byteOffset);
        const [u, v] = this.buffer.subarray(0, 2);
        vec2.set(uvOut, u, v);
    }
    unitIntersect(ray: Ray) {
        return undefined;
    }
}

// f(x) = (|x|² + R² - r²)² - 4·R²·|xy|² = 0
function intersectTorus(ray: Ray, majorRadius: number, minorRadius: number) {
    const { origin, direction } = ray;
    let po = 1.0;

    const Ra2 = majorRadius * majorRadius;
    const ra2 = minorRadius * minorRadius;

    const m = vec3.dot(origin, origin);
    const n = vec3.dot(origin, direction);

    // bounding sphere
    {
        const h = n * n - m + (majorRadius + minorRadius) * (majorRadius + minorRadius);
        if (h < 0.0) return undefined;
        //const t = -n-sqrt(h); // could use this to compute intersections from ro+t*rd
    }

    // find quartic equation
    const k = (m - ra2 - Ra2) / 2.0;
    let k3 = n;
    let k2 = n * n + Ra2 * direction[2] * direction[2] + k;
    let k1 = k * n + Ra2 * origin[2] * direction[2];
    let k0 = k * k + Ra2 * origin[2] * origin[2] - Ra2 * ra2;

    // prevent |c1| from being too close to zero
    if (Math.abs(k3 * (k3 * k3 - k2) + k1) < 0.01) {
        po = -1.0;
        const tmp = k1;
        k1 = k3;
        k3 = tmp;
        k0 = 1.0 / k0;
        k1 = k1 * k0;
        k2 = k2 * k0;
        k3 = k3 * k0;
    }

    let c2 = 2.0 * k2 - 3.0 * k3 * k3;
    let c1 = k3 * (k3 * k3 - k2) + k1;
    let c0 = k3 * (k3 * (-3.0 * k3 * k3 + 4.0 * k2) - 8.0 * k1) + 4.0 * k0;

    c2 /= 3.0;
    c1 *= 2.0;
    c0 /= 3.0;

    const Q = c2 * c2 + c0;
    const R = 3.0 * c0 * c2 - c2 * c2 * c2 - c1 * c1;

    let h = R * R - Q * Q * Q;
    let z = 0.0;
    if (h < 0.0) {
        // 4 intersections
        const sQ = Math.sqrt(Q);
        z = 2.0 * sQ * Math.cos(Math.acos(R / (sQ * Q)) / 3.0);
    } else {
        // 2 intersections
        const sQ = Math.pow(Math.sqrt(h) + Math.abs(R), 1.0 / 3.0);
        z = Math.sign(R) * Math.abs(sQ + Q / sQ);
    }
    z = c2 - z;

    let d1 = z - 3.0 * c2;
    let d2 = z * z - 3.0 * c0;
    if (Math.abs(d1) < 1.0e-4) {
        if (d2 < 0.0) return undefined;
        d2 = Math.sqrt(d2);
    } else {
        if (d1 < 0.0) return undefined;
        d1 = Math.sqrt(d1 / 2.0);
        d2 = c1 / d1;
    }

    //----------------------------------

    let result = Number.MAX_VALUE;

    h = d1 * d1 - z + d2;
    if (h > 0.0) {
        h = Math.sqrt(h);
        let t1 = -d1 - h - k3;
        t1 = po < 0.0 ? 2.0 / t1 : t1;
        let t2 = -d1 + h - k3;
        t2 = po < 0.0 ? 2.0 / t2 : t2;
        if (t1 > 0.0) result = t1;
        if (t2 > 0.0) result = Math.min(result, t2);
    }

    h = d1 * d1 - z - d2;
    if (h > 0.0) {
        h = Math.sqrt(h);
        let t1 = d1 - h - k3;
        t1 = po < 0.0 ? 2.0 / t1 : t1;
        let t2 = d1 + h - k3;
        t2 = po < 0.0 ? 2.0 / t2 : t2;
        if (t1 > 0.0) result = Math.min(result, t1);
        if (t2 > 0.0) result = Math.min(result, t2);
    }

    if (result != Number.MAX_VALUE) return result;
}
