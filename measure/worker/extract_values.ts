
import { mat3, type ReadonlyVec3, vec2, vec3 } from "gl-matrix";
import type { AABB2, CylinderData, FaceData, LoopData, ProductData, SurfaceData } from "./brep";
import { cylinderCenterLine } from "./calculations";
import { matFromInstance, unitToScale } from "./loader";
import { MeasureTool, epsilon } from "./scene";
import type { Surface } from "./surfaces";
import type { CameraValues, CylinderValues, EdgeValues, FaceValues, MeasureSettings, ObjectId, PlaneValues } from "measure";

export async function extractCurveValues(
    product: ProductData,
    pathIdx: number,
    instanceIdx: number,
    pathKind: "edge" | "curveSegment"
): Promise<EdgeValues | undefined> {
    const start = vec3.create();
    const end = vec3.create();

    const parameterData =
        pathKind == "edge"
            ? product.edges[pathIdx]
            : product.curveSegments[pathIdx];
    if (parameterData.curve3D != undefined) {
        const curveData = product.curves3D[parameterData.curve3D];
        switch (curveData.kind) {
            case "line": {
                const mat = matFromInstance(product.instances[instanceIdx]);
                const edgeCurve =
                    pathKind == "edge"
                        ? MeasureTool.geometryFactory.getCurve3DFromEdge(product, pathIdx)
                        : MeasureTool.geometryFactory.getCurve3DFromSegment(product, pathIdx);
                edgeCurve?.eval(parameterData.parameterBounds[0], start, undefined);
                edgeCurve?.eval(parameterData.parameterBounds[1], end, undefined);
                const dir = vec3.subtract(vec3.create(), end, start);

                vec3.transformMat4(start, start, mat);
                vec3.transformMat4(end, end, mat);

                let dist = vec3.len(dir);
                dist *= unitToScale(product.units);
                vec3.normalize(dir, dir);
                return { kind: "line", distance: dist, gradient: dir, start, end };
            }
            case "circle": {
                const totalAngle =
                    parameterData.parameterBounds[1] - parameterData.parameterBounds[0];
                return {
                    kind: "arc",
                    radius: curveData.radius * unitToScale(product.units),
                    totalAngle,
                };
            }
            case "lineStrip": {
                const closed = vec3.equals(
                    curveData.vertices[0],
                    curveData.vertices[curveData.vertices.length - 1]
                );
                return {
                    kind: "lineStrip",
                    totalLength: closed
                        ? undefined
                        : (parameterData.parameterBounds[1] -
                            parameterData.parameterBounds[0]) *
                        unitToScale(product.units),
                };
            }
        }
    }
}

export async function extractPlaneValues(prodId: ObjectId, faceIdx: number, product: ProductData, instanceIdx: number, faceData: FaceData, surf: Surface, scale: number): Promise<PlaneValues> {
    type MutableAABB2 = { readonly min: vec2; readonly max: vec2 };
    function union(out: MutableAABB2, a: AABB2) {
        vec2.min(out.min, out.min, a.min);
        vec2.max(out.max, out.max, a.max);
    }

    const loopToEdges = async (
        loop: LoopData
    ): Promise<{
        edges: EdgeValues[];
        useRadius: boolean;
        radius: number | undefined;
    }> => {
        let useRadius = true;
        let radius = 0.0 as number | undefined;
        let edges: EdgeValues[] = [];
        for (const halfEdgeIdx of loop.halfEdges) {
            const halfEdgeData = product.halfEdges[halfEdgeIdx];
            const edgeValue = await extractCurveValues(
                product,
                halfEdgeData.edge,
                instanceIdx,
                "edge"
            );
            if (edgeValue) {
                if (useRadius) {
                    if (edgeValue.kind != "arc") {
                        useRadius = false;
                        radius = undefined;
                    } else {
                        radius = Math.max(edgeValue.radius, radius as number) * scale;
                    }
                }
                edges.push(edgeValue);
            }
        }
        return {
            edges,
            useRadius,
            radius,
        };
    };

    const mat = matFromInstance(product.instances[instanceIdx]);
    function addVertexFromIndex(points: ReadonlyVec3[], index: number) {
        const v = vec3.clone(product!.vertices[index].position);
        vec3.transformMat4(v as vec3, v, mat);
        points.push(v);
    }
    let hasWidthAndHeight = true;
    const loop = product.loops[faceData.outerLoop];
    const aabb = {
        min: vec2.fromValues(Number.MAX_VALUE, Number.MAX_VALUE),
        max: vec2.fromValues(-Number.MAX_VALUE, -Number.MAX_VALUE),
    };
    let verts: ReadonlyVec3[] = [];
    for (const halfEdgeIdx of loop.halfEdges) {
        const aabb2 = MeasureTool.geometryFactory.getHalfEdgeAABB(product, halfEdgeIdx);
        if (!aabb2) {
            break;
        }
        union(aabb, aabb2);

        const halfEdgeData = product.halfEdges[halfEdgeIdx];
        const edgeData = product.edges[halfEdgeData.edge];
        if (edgeData.vertices) {
            if (halfEdgeData.direction === 1) {
                addVertexFromIndex(verts, edgeData.vertices[0]);
            } else {
                addVertexFromIndex(verts, edgeData.vertices[1]);
            }
        }
    }

    const normal = vec3.create();
    const normalMat = mat3.normalFromMat4(mat3.create(), mat);
    surf.evalNormal(normal, [0, 0]);
    vec3.transformMat3(normal, normal, normalMat);
    const xyNormal = vec3.fromValues(0, 0, 1);
    const dotXyPlane = Math.abs(vec3.dot(normal, xyNormal));
    let heightAboveXyPlane: number | undefined = undefined;
    if (1 - dotXyPlane < epsilon) {
        const pos = vec3.create();
        surf.evalPosition(pos, [0, 0]);
        vec3.scale(pos, pos, 1 / scale);
        vec3.transformMat4(pos, pos, mat);
        heightAboveXyPlane = pos[2];
    }

    let outerEdges = await loopToEdges(loop);

    let innerEdges: EdgeValues[][] = [];
    let innerRadius = undefined as number | undefined;
    if (faceData.innerLoops) {
        let useInnerRadius = true;
        innerRadius = 0.0;
        for (const innerLoopIdx of faceData.innerLoops) {
            const innerLoop = product.loops[innerLoopIdx];
            const edgeResult = await loopToEdges(innerLoop);
            innerEdges.push(edgeResult.edges);
            useInnerRadius = edgeResult.useRadius && useInnerRadius;
            if (edgeResult.radius) {
                innerRadius = Math.max(innerRadius as number, edgeResult.radius);
            }
        }
        if (!useInnerRadius) {
            innerRadius = undefined;
        }
    }

    let width = undefined;
    let height = undefined;
    if (!outerEdges.useRadius) {
        width = (aabb.max[0] - aabb.min[0]) * scale;
        height = (aabb.max[1] - aabb.min[1]) * scale;
    }

    return {
        kind: "plane",
        width,
        height,
        outerRadius: outerEdges.radius,
        innerRadius,
        normal: normal,
        area: faceData.area ? faceData.area * scale * scale : undefined,
        vertices: verts as vec3[],
        outerEdges: outerEdges.edges,
        innerEdges,
        heightAboveXyPlane,
        entity: {
            ObjectId: prodId, drawKind: "face", pathIndex: faceIdx, instanceIndex: instanceIdx
        },
        errorMargin: product.loops[faceData.outerLoop].errorMargin
    };
}

export async function extractCylinderValues(prodId: ObjectId, faceIdx: number, product: ProductData, instanceIdx: number,
    faceData: FaceData, cylinderData: CylinderData, scale: number, setting?: MeasureSettings): Promise<CylinderValues> {

    const mat = matFromInstance(product.instances[instanceIdx]);
    const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
        product,
        faceData,
        cylinderData,
        mat,
        setting ? setting.cylinderMeasure : "center"
    );
    return {
        kind: "cylinder",
        radius: cylinderData.radius * scale,
        centerLineStart: cylinderOrigo,
        centerLineEnd: cylinderEnd,
        entity: {
            ObjectId: prodId, drawKind: "face", pathIndex: faceIdx, instanceIndex: instanceIdx
        }
    };
}


export async function extractFaceValues(
    prodId: ObjectId,
    product: ProductData,
    faceIdx: number,
    instanceIdx: number,
    setting?: MeasureSettings
): Promise<FaceValues | undefined> {

    const faceData = product.faces[faceIdx];
    const scale = unitToScale(product.units);
    const surfaceData = product.surfaces[faceData.surface];
    const surf = MeasureTool.geometryFactory.getSurface(
        surfaceData,
        faceData.facing,
        scale
    );
    switch (surf.kind) {
        case "plane": {
            return await extractPlaneValues(prodId, faceIdx, product, instanceIdx, faceData, surf, scale);
        }
        case "cylinder": {
            const cylinderData = surfaceData as CylinderData;
            return await extractCylinderValues(prodId, faceIdx, product, instanceIdx, faceData, cylinderData, scale, setting);
        }
    }
}

export async function extractCameraValuesFromFace(
    product: ProductData,
    faceIdx: number,
    instanceIdx: number,
    cameraDir: vec3,
    setting?: MeasureSettings
): Promise<CameraValues | undefined> {
    const faceData = product.faces[faceIdx];
    const surfaceData = product.surfaces[faceData.surface];
    switch (surfaceData.kind) {
        case "cylinder": {
            const cylinderA = surfaceData as CylinderData;
            const mat = matFromInstance(product.instances[instanceIdx]);
            const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
                product,
                faceData,
                cylinderA,
                mat,
                setting ? setting.cylinderMeasure : "center"
            );
            const cylinderDir = vec3.sub(vec3.create(), cylinderEnd, cylinderOrigo);
            vec3.normalize(cylinderDir, cylinderDir);
            const dotCamera = vec3.dot(cameraDir, cylinderDir);
            if (Math.abs(dotCamera) > 0.8) {
                let position: vec3;
                if (dotCamera < 0) {
                    position = cylinderEnd;
                } else {
                    vec3.negate(cylinderDir, cylinderDir);
                    position = cylinderOrigo;
                }
                return { normal: cylinderDir, position };
            }
            const position = vec3.lerp(
                vec3.create(),
                cylinderOrigo,
                cylinderEnd,
                0.5
            );

            const xAxis = vec3.cross(
                vec3.create(),
                cylinderDir,
                vec3.fromValues(1, 0, 0)
            );
            const dotX = vec3.dot(cameraDir, xAxis);
            const absDotX = Math.abs(dotX);
            const yAxis = vec3.cross(
                vec3.create(),
                cylinderDir,
                vec3.fromValues(0, 1, 0)
            );
            const dotY = vec3.dot(cameraDir, yAxis);
            const absDotY = Math.abs(dotY);
            const zAxis = vec3.cross(
                vec3.create(),
                cylinderDir,
                vec3.fromValues(0, 0, 1)
            );
            const dotZ = vec3.dot(cameraDir, zAxis);
            const absDotZ = Math.abs(dotZ);

            if (absDotX > absDotY && absDotX > absDotZ) {
                if (dotX > 0) {
                    vec3.negate(xAxis, xAxis);
                }
                return { normal: xAxis, position };
            } else if (absDotY > absDotZ) {
                if (dotY > 0) {
                    vec3.negate(yAxis, yAxis);
                }
                return { normal: yAxis, position };
            } else {
                if (dotZ > 0) {
                    vec3.negate(zAxis, zAxis);
                }
                return { normal: zAxis, position };
            }
        }
    }
}
