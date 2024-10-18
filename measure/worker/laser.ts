import { glMatrix, vec3, type ReadonlyVec3, mat4, vec2, type ReadonlyMat4 } from "gl-matrix";
import type { CylinderData, FaceData, LoopData, PlaneData, ProductData } from "./brep";
import { cylinderCenterLine, intersectionParameter } from "./calculations";
import { matFromInstance } from "./loader";
import type { LaserIntersections } from "measure";
import { closestPointToLine } from "./util";
import { MeasureTool } from "./scene";
import { pointAtAngle, type Arc3D, type LineSegment3D, type Ray, type Curve3D, lineToSegment, Line3D, LineStrip3D } from "./curves";

interface Intersection {
    point: vec3,
    t: number
}

function rayToLineIntersection(ray: Ray, seg: LineSegment3D): Intersection | undefined {
    const parallel =
        vec3.equals(seg.dir, ray.dir) ||
        vec3.equals(seg.dir, vec3.negate(vec3.create(), ray.dir));
    if (parallel) {
        return undefined;
    }
    const length = vec3.dist(seg.start, seg.end);
    const t = intersectionParameter(seg, ray);
    if (t > 0 && t < length) {
        const point = vec3.scaleAndAdd(vec3.create(), seg.start, seg.dir, t);
        const toPoint = vec3.subtract(vec3.create(), point, ray.start);
        const rayT = vec3.dot(toPoint, ray.dir) / vec3.dot(ray.dir, ray.dir);
        return { point, t: rayT };
    }
}

function rayToArcIntersection(ray: Ray, arc: Arc3D): Intersection | undefined {
    const toPoint = vec3.subtract(vec3.create(), arc.origin, ray.start);
    const rayT = vec3.dot(toPoint, ray.dir) / vec3.dot(ray.dir, ray.dir);
    const rayPoint = vec3.scaleAndAdd(vec3.create(), ray.start, ray.dir, rayT);
    const t = pointAtAngle(rayPoint, arc);
    if (t <= arc.endParam && t >= arc.beginParam) {
        const point = vec3.create();
        arc.eval(t, point, undefined);
        return { point, t: rayT };
    }
}


function rayToCurveIntersection(product: ProductData, curve: Curve3D, ray: Ray): (Intersection | undefined)[] {
    const intersections: (Intersection | undefined)[] = [];
    switch (curve.kind) {
        case "line":
            return [rayToLineIntersection(ray, lineToSegment(curve as Line3D))]
        case "arc":
            return [rayToArcIntersection(ray, curve as Arc3D)];
        case "lineStrip":
            {
                const strip = curve as LineStrip3D;
                const segments = strip.toSegments();
                for (const seg of segments) {
                    intersections.push(rayToLineIntersection(ray, seg));
                }
                return intersections;
            }
    }
    return intersections;
}

export async function getLaserCylinderValues(product: ProductData, instanceIdx: number, cylinderData: CylinderData,
    face: FaceData, position: ReadonlyVec3): Promise<LaserIntersections> {
    const mat = matFromInstance(product.instances[instanceIdx]);
    const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
        product,
        face,
        cylinderData,
        mat,
        "center"
    );

    const dir = vec3.sub(vec3.create(), cylinderOrigo, cylinderEnd);

    const up = glMatrix.equals(
        Math.abs(vec3.dot(vec3.fromValues(0, 0, 1), dir)),
        1
    )
        ? vec3.fromValues(0, 1, 0)
        : vec3.fromValues(0, 0, 1);

    const right = vec3.cross(vec3.create(), up, dir);
    vec3.cross(up, dir, right);

    const z: ReadonlyVec3[][] = [];
    z.push([cylinderOrigo]);
    z.push([cylinderEnd]);


    const { pos } = closestPointToLine(position, cylinderOrigo, cylinderEnd);
    const x: ReadonlyVec3[][] = [];
    x.push([vec3.scaleAndAdd(vec3.create(), pos, right, cylinderData.radius)]);
    x.push([vec3.scaleAndAdd(vec3.create(), pos, right, -cylinderData.radius)]);
    const y: ReadonlyVec3[][] = [];
    y.push([vec3.scaleAndAdd(vec3.create(), pos, up, cylinderData.radius)]);
    y.push([vec3.scaleAndAdd(vec3.create(), pos, up, -cylinderData.radius)]);
    return { kind: "cylinder", x, y, z, xDirection: right, yDirection: up, zDirection: dir };
}

function getXDirectionFromMat4(matrix: mat4): vec3 {
    const xDirection = vec3.fromValues(matrix[0], matrix[1], matrix[2]);
    return vec3.normalize(xDirection, xDirection); // Normalize the vector if you need a unit vector
}

function getYDirectionFromMat4(matrix: mat4): vec3 {
    const yDirection = vec3.fromValues(matrix[4], matrix[5], matrix[6]);
    return vec3.normalize(yDirection, yDirection); // Normalize the vector if you need a unit vector
}

function getZDirectionFromMat4(matrix: mat4): vec3 {
    const yDirection = vec3.fromValues(matrix[8], matrix[9], matrix[10]);
    return vec3.normalize(yDirection, yDirection); // Normalize the vector if you need a unit vector
}

function intersectionsFromLoop(product: ProductData, ray: Ray, loop: LoopData) {
    const intersections: (Intersection | undefined)[] = [];
    for (const halfEdgeIdx of loop.halfEdges) {
        const halfEdgeData = product.halfEdges[halfEdgeIdx];
        const edgeCurve = MeasureTool.geometryFactory.getCurve3DFromEdge(
            product,
            halfEdgeData.edge
        );
        if (edgeCurve) {
            intersections.push(...rayToCurveIntersection(product, edgeCurve, ray))
        }
    }
    return intersections.filter(i => i != undefined);
}

function intersectionsFromFace(product: ProductData, ray: Ray, face: FaceData) {
    const intersections: (Intersection | undefined)[] = [];
    const outerLoop = product.loops[face.outerLoop];
    intersections.push(...intersectionsFromLoop(product, ray, outerLoop));
    if (face.innerLoops) {
        for (const voidIdx of face.innerLoops) {
            const voidLoop = product.loops[voidIdx];
            intersections.push(...intersectionsFromLoop(product, ray, voidLoop));
        }
    }
    return intersections as Intersection[];
}

function transformArray(ar: vec3[], mat: ReadonlyMat4) {
    for (const v of ar) {
        vec3.transformMat4(v, v, mat);
    }
    return ar;
}

export async function getLaserPlaneValues(product: ProductData, instanceIdx: number, planeData: PlaneData,
    face: FaceData, position: ReadonlyVec3): Promise<LaserIntersections> {
    const mat = matFromInstance(product.instances[instanceIdx]);
    const worldToObject = mat4.invert(mat4.create(), mat);

    const localPoint = vec3.transformMat4(
        vec3.create(),
        position,
        worldToObject
    );
    const uv = vec2.create();
    const plane = MeasureTool.geometryFactory.getSurface(planeData, 1);
    plane.invert(uv, localPoint);
    const surfacePoint = vec3.create();
    plane.evalPosition(surfacePoint, uv);

    const planeTransform = mat4.fromValues(
        ...(planeData.transform as Parameters<typeof mat4.fromValues>)
    );
    const xRay = { start: localPoint, dir: getXDirectionFromMat4(planeTransform) };
    const yRay = { start: localPoint, dir: getYDirectionFromMat4(planeTransform) };

    const xIntersections = intersectionsFromFace(product, xRay, face);
    const yIntersections = intersectionsFromFace(product, yRay, face);
    const posX = transformArray(xIntersections.filter(i => i.t >= 0).sort((a, b) => a.t - b.t).map(i => i.point), mat);
    const negX = transformArray(xIntersections.filter(i => i.t < 0).sort((a, b) => b.t - a.t).map(i => i.point), mat);

    const posY = transformArray(yIntersections.filter(i => i.t >= 0).sort((a, b) => a.t - b.t).map(i => i.point), mat);
    const negY = transformArray(yIntersections.filter(i => i.t < 0).sort((a, b) => b.t - a.t).map(i => i.point), mat);

    return { kind: "plane", x: [posX, negX], y: [posY, negY], z: [], xDirection: xRay.dir, yDirection: yRay.dir, zDirection: getZDirectionFromMat4(planeTransform) };
}