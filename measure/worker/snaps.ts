import type { ReadonlyMat4, ReadonlyVec3, ReadonlyVec4 } from "gl-matrix";
import { mat3, mat4, vec2, vec3, vec4 } from "gl-matrix";
import type { AABB3, EdgeData, ProductData } from "./brep";
import { isInsideAABB } from "./calculations";
import type { Curve3D } from "./curves";
import { crawlInstance, matFromInstance, unitToScale } from "./loader";
import type { Surface } from "./surfaces";
import type { SnapTolerance } from "measure/modules";
import type { MeasureEntity } from "measure/measure_view";
import { MeasureTool } from "./scene";
import { getEdgeStripFromIdx } from "./util";


export interface EntityPicker {
    instanceIdx: number;
    worldToObject: ReadonlyMat4;
}


export interface EdgePickInfo {
    idx: number;
    curve: Curve3D;
    data: EdgeData;
}

export interface SegmentPickInfo {
    idx: number;
    readonly curve: Curve3D;
}

export interface PickSegments extends EntityPicker {
    segments: SegmentPickInfo[];
}

export interface PickEdges extends EntityPicker {
    instanceMat: ReadonlyMat4;
    edges: EdgePickInfo[];
}

export interface SurfacePickInfo {
    idx: number;
    aabb: AABB3;
    surface: Surface;
}

export interface PickSurfaces extends EntityPicker {
    instanceMat: ReadonlyMat4;
    surfaces: SurfacePickInfo[];
}


export interface FacePickInfo {
    idx: number;
    aabb: AABB3;
    planes: ReadonlyVec4[];
    loop: ReadonlyVec3[];
}

export interface PickFaces extends EntityPicker {
    instanceMat: ReadonlyMat4;
    faces: FacePickInfo[];
}


export interface PointsPickInfo {
    idx: number,
    vertexIndices: number[];
    vertices: ReadonlyVec3[];
    aabb: AABB3;
}


export interface PickPoints extends EntityPicker {
    instanceMat: ReadonlyMat4;
    points: PointsPickInfo[];
}

export interface PickInterface {
    objectId: number;
    unitScale: number;
    segments: PickSegments[];
    edges: PickEdges[];
    surfaces: PickSurfaces[];
    faces: PickFaces[];
    snappingPoints: PickPoints[];
}

function closestCandiateOnSurfaces(pickInterface: PickInterface, position: ReadonlyVec3, tolerance: number) {
    let closestCandidate: { entity: MeasureEntity, connectionPoint: vec3, distance: number } | undefined = undefined;
    for (const faceInstance of pickInterface.surfaces) {
        const localPoint = vec3.transformMat4(
            vec3.create(),
            position,
            faceInstance.worldToObject
        );
        for (const face of faceInstance.surfaces) {
            if (isInsideAABB(localPoint, face.aabb, tolerance)) {
                const uv = vec2.create();
                face.surface.invert(uv, localPoint);
                const surfacePoint = vec3.create();
                face.surface.evalPosition(surfacePoint, uv);

                const distance = vec3.dist(surfacePoint, localPoint);
                if (distance < tolerance && (!closestCandidate || distance < closestCandidate.distance)) {
                    vec3.transformMat4(surfacePoint, surfacePoint, faceInstance.instanceMat);
                    closestCandidate = {
                        entity: {
                            ObjectId: pickInterface.objectId,
                            drawKind: "face",
                            pathIndex: face.idx,
                            instanceIndex: faceInstance.instanceIdx,
                            parameter: uv,
                        },
                        connectionPoint: surfacePoint,
                        distance
                    };
                }
            }
        }
        return closestCandidate;
    }
}

function closestCandiateOnPolyMeshSurface(pickInterface: PickInterface, position: ReadonlyVec3, tolerance: number) {
    let closestCandidate: { entity: MeasureEntity, connectionPoint: vec3, distance: number } | undefined = undefined;
    for (const faceInstance of pickInterface.faces) {
        const localPoint = vec3.transformMat4(
            vec3.create(),
            position,
            faceInstance.worldToObject
        );
        for (const face of faceInstance.faces) {
            if (isInsideAABB(localPoint, face.aabb, tolerance)) {
                const point = pointOnFace(face, localPoint, face.loop, tolerance);
                if (point && (!closestCandidate || point.dist < closestCandidate.distance)) {
                    vec3.transformMat4(point.connectionPoint, point.connectionPoint, faceInstance.instanceMat);
                    closestCandidate = {
                        entity: {
                            ObjectId: pickInterface.objectId,
                            drawKind: "face",
                            pathIndex: face.idx,
                            instanceIndex: faceInstance.instanceIdx,
                        },
                        connectionPoint: point.connectionPoint,
                        distance: point.dist
                    };
                }
            }
        }
    }
    return closestCandidate;
}

function closestSnappingPoints(pickInterface: PickInterface, position: ReadonlyVec3, tolerance: number | undefined, getAll: boolean) {
    let closestCandidate: { entity: MeasureEntity, connectionPoint: vec3, distance: number } | undefined = undefined;
    for (const pointInstance of pickInterface.snappingPoints) {
        const localPoint = vec3.transformMat4(
            vec3.create(),
            position,
            pointInstance.worldToObject
        );
        for (const snapPoints of pointInstance.points) {
            if (isInsideAABB(localPoint, snapPoints.aabb, tolerance ? tolerance : 0.1)) {
                for (let i = 0; i < snapPoints.vertexIndices.length; ++i) {
                    const point = snapPoints.vertices[i];
                    const distance = vec3.dist(point, localPoint);
                    if ((!closestCandidate || distance < closestCandidate.distance) &&
                        (tolerance == undefined || distance < tolerance)) {
                        if (getAll) {
                            closestCandidate = {
                                entity: {
                                    ObjectId: pickInterface.objectId,
                                    drawKind: "points",
                                    pathIndex: snapPoints.idx,
                                    instanceIndex: pointInstance.instanceIdx,
                                },
                                connectionPoint: vec3.clone(point),
                                distance
                            }
                        } else {
                            closestCandidate = {
                                entity: {
                                    ObjectId: pickInterface.objectId,
                                    drawKind: "vertex",
                                    pathIndex: snapPoints.vertexIndices[i],
                                    instanceIndex: pointInstance.instanceIdx,
                                    parameter: vec3.clone(point)
                                },
                                connectionPoint: vec3.clone(point),
                                distance
                            }
                        }

                    }
                }
            }
        }
    }
    return closestCandidate;
}

function projectPointOntoPlane(point: ReadonlyVec3, planeNormal: ReadonlyVec3, planePoint: ReadonlyVec3): vec3 {
    const planeToPoint = vec3.subtract(vec3.create(), point, planePoint);
    const d = vec3.dot(planeToPoint, planeNormal);
    const projection = vec3.scaleAndAdd(vec3.create(), point, planeNormal, -d);
    return projection;
}

function getPlaneToWorldRotation(planeNormal: vec3): mat3 {
    const xAxis = vec3.create();
    const yAxis = vec3.create();
    const zAxis = vec3.normalize(vec3.create(), planeNormal);

    if (Math.abs(zAxis[0]) < Math.abs(zAxis[1]) && Math.abs(zAxis[0]) < Math.abs(zAxis[2])) {
        vec3.set(xAxis, 1, 0, 0);
    } else if (Math.abs(zAxis[1]) < Math.abs(zAxis[2])) {
        vec3.set(xAxis, 0, 1, 0);
    } else {
        vec3.set(xAxis, 0, 0, 1);
    }

    vec3.cross(xAxis, xAxis, zAxis);
    vec3.normalize(xAxis, xAxis);
    vec3.cross(yAxis, zAxis, xAxis);

    return mat3.fromValues(
        xAxis[0], yAxis[0], zAxis[0],
        xAxis[1], yAxis[1], zAxis[1],
        xAxis[2], yAxis[2], zAxis[2]
    );
}

function isPointInPolygon(point: vec2, polygon: vec2[]): boolean {
    let intersects = 0;
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];

        if (((a[1] > point[1]) !== (b[1] > point[1])) &&
            (point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0])) {
            intersects++;
        }
    }
    return intersects % 2 === 1;
}

function pointOnFace(face: FacePickInfo, point: ReadonlyVec3, loop: ReadonlyVec3[], tolerance: number) {
    let closestPlane: { planeIdx: number, d: number } | undefined;
    const p = vec4.fromValues(point[0], point[1], point[2], 1);
    for (let i = 0; i < face.planes.length; ++i) {
        const plane = face.planes[i];
        let d = vec4.dot(plane, p) - (plane[3] * 2);
        if (!closestPlane || Math.abs(d) < Math.abs(closestPlane.d)) {
            closestPlane = { planeIdx: i, d };
        }
    }

    if (closestPlane && Math.abs(closestPlane.d) < tolerance) {
        const plane = face.planes[closestPlane.planeIdx];
        const normal = vec3.fromValues(plane[0], plane[1], plane[2]);
        const planePoint = vec3.create();
        const planeRotation = getPlaneToWorldRotation(normal);
        vec3.scaleAndAdd(planePoint, planePoint, normal, closestPlane.d);
        const planeToPoint = vec3.subtract(vec3.create(), point, planePoint);
        const connectionPoint = vec3.scaleAndAdd(vec3.create(), planeToPoint, normal, -closestPlane.d);
        const rotatedPickPoint = vec3.transformMat3(vec3.create(), connectionPoint, planeRotation);
        const pickPointOnPlane = vec2.fromValues(rotatedPickPoint[0], rotatedPickPoint[1]);

        const projectedLoop = loop.map(vertex => {
            const projectedVertex = projectPointOntoPlane(vertex, normal, planePoint);
            vec3.transformMat3(projectedVertex, projectedVertex, planeRotation);
            return vec2.fromValues(projectedVertex[0], projectedVertex[1]);
        });

        if (isPointInPolygon(pickPointOnPlane, projectedLoop)) {
            return { connectionPoint, dist: Math.abs(closestPlane.d) };
        }
    }
}

export async function getPickInterface(product: ProductData, objectId: number): Promise<PickInterface> {
    const edgeInstances = new Array<Array<number>>(product.instances.length);
    const faceInstances = new Array<Array<number>>(product.instances.length);
    const pointsInstances = new Array<Array<number>>(product.instances.length);
    const curveSegmentInstances = new Array<readonly number[]>(
        product.instances.length
    );
    const surfaceLessLoops = new Map<number, ReadonlyVec3[]>();

    for (let i = 0; i < product.instances.length; ++i) {
        const instanceData = product.instances[i];

        const edges = new Array<number>();
        const faces = new Array<number>();
        const snappingPoints = new Array<number>();

        function faceFunc(faceIdx: number) {
            faces.push(faceIdx);
            if (product) {
                const face = product.faces[faceIdx];
                const loops = [face.outerLoop, ...(face.innerLoops ?? [])];
                for (const loopIdx of loops) {
                    const loop = product.loops[loopIdx];
                    for (const halfEdgeIdx of loop.halfEdges) {
                        const halfEdge = product.halfEdges[halfEdgeIdx];
                        edges.push(halfEdge.edge);
                        if (face.surface === undefined) {
                            const edgeStrip = getEdgeStripFromIdx(product, halfEdge.edge, i);
                            if (edgeStrip) {
                                const points = surfaceLessLoops.get(faceIdx);
                                edgeStrip.shift();
                                if (points) {
                                    points.push(...edgeStrip);
                                } else {
                                    surfaceLessLoops.set(faceIdx, edgeStrip);
                                }
                            }
                        }
                    }
                }
            }
        }


        function snappingPointFunc(snapIdx: number) {
            snappingPoints.push(snapIdx);
        }

        if (typeof instanceData.geometry == "number") {
            //check geom is number
            crawlInstance(product, instanceData, faceFunc, snappingPointFunc);
        }
        const geometryData =
            product.geometries[instanceData.geometry as number];
        if (geometryData.compoundCurve) {
            curveSegmentInstances[i] = geometryData.compoundCurve;
        } else {
            curveSegmentInstances[i] = [];
        }

        edgeInstances[i] = edges;
        faceInstances[i] = faces;
        pointsInstances[i] = snappingPoints;
    }

    const segments: PickSegments[] = [];
    for (let i = 0; i < curveSegmentInstances.length; ++i) {
        const instanceData = product.instances[i];
        const instanceMat = matFromInstance(instanceData);
        const worldToObject = mat4.invert(mat4.create(), instanceMat);
        const curves: SegmentPickInfo[] = [];

        for (const segmentIdx of curveSegmentInstances[i]) {
            const curve = MeasureTool.geometryFactory.getCurve3DFromSegment(
                product,
                segmentIdx
            );
            if (curve) {
                curves.push({ idx: segmentIdx, curve: curve as Curve3D })
            }
        }
        if (curves.length > 0) {
            segments.push({ segments: curves, instanceIdx: i, worldToObject });
        }
    }

    const edges: PickEdges[] = [];
    for (let i = 0; i < edgeInstances.length; ++i) {
        const InstanceData = product.instances[i];
        const instanceMat = matFromInstance(InstanceData);
        const worldToObject = mat4.invert(mat4.create(), instanceMat);

        const curves: EdgePickInfo[] = [];
        for (const edgeIdx of edgeInstances[i]) {
            const edgeData = product.edges[edgeIdx];
            if (edgeData.virtual) {
                continue;
            }
            const curve = MeasureTool.geometryFactory.getCurve3DFromEdge(
                product,
                edgeIdx,
                1
            );
            if (curve) {
                curves.push({ data: edgeData, idx: edgeIdx, curve: curve as Curve3D });
            }
        }
        if (curves.length > 0) {
            edges.push({ instanceIdx: i, worldToObject, instanceMat, edges: curves })
        }
    }

    const surfaces: PickSurfaces[] = [];
    const faces: PickFaces[] = [];
    for (let i = 0; i < faceInstances.length; ++i) {
        const InstanceData = product.instances[i];
        const instanceMat = matFromInstance(InstanceData);
        const worldToObject = mat4.invert(mat4.create(), instanceMat);
        const instanceSurfaces: SurfacePickInfo[] = [];
        const instanceFaces: FacePickInfo[] = [];
        for (const faceIdx of faceInstances[i]) {
            const faceData = product.faces[faceIdx];
            if (faceData.surface !== undefined) {
                const surfaceData = product.surfaces[faceData.surface];
                const surface = MeasureTool.geometryFactory.getSurface(surfaceData, 1);
                instanceSurfaces.push({ aabb: faceData.aabb, idx: faceIdx, surface: surface as Surface })
            } else if (faceData.pickingSurfaces) {
                const loop = surfaceLessLoops.get(faceIdx);
                if (loop) {
                    instanceFaces.push({ aabb: faceData.aabb, idx: faceIdx, planes: faceData.pickingSurfaces, loop })
                }
            }
        }
        if (instanceSurfaces.length > 0) {
            surfaces.push({ instanceIdx: i, worldToObject, surfaces: instanceSurfaces, instanceMat });
        }
        if (instanceFaces.length > 0) {
            faces.push({ instanceIdx: i, worldToObject, faces: instanceFaces, instanceMat });
        }
    }

    const snappingPoints: PickPoints[] = [];
    for (let i = 0; i < pointsInstances.length; ++i) {
        const InstanceData = product.instances[i];
        const instanceMat = matFromInstance(InstanceData);
        const worldToObject = mat4.invert(mat4.create(), instanceMat);
        const surfaces: PointsPickInfo[] = [];
        for (const pointIdx of pointsInstances[i]) {
            const pointsData = product.snappingPoints[pointIdx];
            surfaces.push({ idx: pointIdx, aabb: pointsData.aabb, vertexIndices: pointsData.points, vertices: pointsData.points.map(i => product.vertices[i].position) })
        }
        snappingPoints.push({ instanceIdx: i, worldToObject, points: surfaces, instanceMat });
    }

    return { objectId, edges, segments, surfaces, faces, snappingPoints, unitScale: unitToScale(product.units) };
}


export function pickFace(pickInterface: PickInterface, position: ReadonlyVec3, tolerance: number): { entity: MeasureEntity, connectionPoint: vec3, faceType: "surface" | "polymesh" | "points" } | undefined {
    const closestSurface = closestCandiateOnSurfaces(pickInterface, position, tolerance);
    if (closestSurface) {
        return { ...closestSurface, faceType: "surface" };
    }
    const closestFace = closestCandiateOnPolyMeshSurface(pickInterface, position, tolerance);
    if (closestFace) {
        return { ...closestFace, faceType: "polymesh" };
    }
    const closestPointSet = closestSnappingPoints(pickInterface, position, undefined, true);
    if (closestPointSet) {
        return { ...closestPointSet, faceType: "points" };
    }
}

export function pick(pickInterface: PickInterface, position: ReadonlyVec3, tolerance: SnapTolerance): { entity: MeasureEntity, connectionPoint: vec3 } | undefined {
    const edgeTolerance = tolerance.edge ? tolerance.edge / pickInterface.unitScale : undefined;
    const segmentTolerance = tolerance.segment ? tolerance.segment / pickInterface.unitScale : undefined;
    const faceTolerance = tolerance.face ? tolerance.face / pickInterface.unitScale : undefined;
    const pointTolerance = tolerance.point ? tolerance.point / pickInterface.unitScale : undefined;

    if (segmentTolerance) {
        for (const instanceSeg of pickInterface.segments) {
            const localPoint = vec3.transformMat4(
                vec3.create(),
                position,
                instanceSeg.worldToObject
            );
            for (const seg of instanceSeg.segments) {
                const t = seg.curve.invert(localPoint);
                const curvePoint = vec3.create();
                seg.curve.eval(t, curvePoint, undefined);
                const dist = vec3.dist(curvePoint, localPoint);
                if (dist < segmentTolerance) {
                    return {
                        entity: {
                            ObjectId: pickInterface.objectId,
                            drawKind: "curveSegment",
                            pathIndex: seg.idx,
                            instanceIndex: instanceSeg.instanceIdx,
                            parameter: t,
                        },
                        connectionPoint: curvePoint
                    };
                }
            }
        }
    }

    let closestCandidate: { entity: MeasureEntity, connectionPoint: vec3 } | undefined = undefined;
    let closestDistance = Number.MAX_VALUE;
    let pointSelected = false;

    if (edgeTolerance || pointTolerance) {
        let aabbTol = 0;
        if (edgeTolerance && pointTolerance) {
            aabbTol = pointTolerance > edgeTolerance ? pointTolerance : edgeTolerance;
        } else {
            aabbTol = edgeTolerance ? edgeTolerance : pointTolerance ? pointTolerance : 0;
        }
        for (const instanceEdge of pickInterface.edges) {
            const localPoint = vec3.transformMat4(
                vec3.create(),
                position,
                instanceEdge.worldToObject
            );
            for (const edge of instanceEdge.edges) {
                if (isInsideAABB(localPoint, edge.data.aabb, aabbTol)) {
                    const t = edge.curve.invert(localPoint);
                    const curvePoint = vec3.create();
                    if (edge.data.vertices && edge.curve.kind != "arc" && pointTolerance) {
                        const distToStart = Math.abs(edge.data.parameterBounds[0] - t);
                        if (distToStart < pointTolerance && distToStart < closestDistance) {

                            edge.curve.eval(
                                edge.data.parameterBounds[0],
                                curvePoint,
                                undefined
                            );
                            const actualDistance = vec3.dist(curvePoint, localPoint);
                            if (actualDistance < pointTolerance && actualDistance < closestDistance) {
                                pointSelected = true;
                                closestDistance = actualDistance;
                                vec3.transformMat4(curvePoint, curvePoint, instanceEdge.instanceMat);
                                closestCandidate = {
                                    entity: {
                                        ObjectId: pickInterface.objectId,
                                        drawKind: "vertex",
                                        pathIndex: edge.data.vertices[0],
                                        instanceIndex: instanceEdge.instanceIdx,
                                        parameter: vec3.clone(curvePoint),
                                    },
                                    connectionPoint: vec3.clone(curvePoint)
                                }
                            }
                        }
                        const distToEnd = Math.abs(edge.data.parameterBounds[1] - t);
                        if (distToEnd < pointTolerance && distToEnd < closestDistance) {
                            edge.curve.eval(
                                edge.data.parameterBounds[1],
                                curvePoint,
                                undefined
                            );
                            const actualDistance = vec3.dist(curvePoint, localPoint);
                            if (actualDistance < pointTolerance && actualDistance < closestDistance) {
                                pointSelected = true;
                                closestDistance = actualDistance;
                                vec3.transformMat4(curvePoint, curvePoint, instanceEdge.instanceMat);
                                closestCandidate = {
                                    entity: {
                                        ObjectId: pickInterface.objectId,
                                        drawKind: "vertex",
                                        pathIndex: edge.data.vertices[1],
                                        instanceIndex: instanceEdge.instanceIdx,
                                        parameter: vec3.clone(curvePoint),
                                    },
                                    connectionPoint: vec3.clone(curvePoint)
                                };
                            }
                        }
                    }
                    if (!pointSelected && edgeTolerance) {
                        edge.curve.eval(t, curvePoint, undefined);
                        const dist = vec3.dist(curvePoint, localPoint);
                        if (dist < edgeTolerance && dist < closestDistance) {
                            closestDistance = dist;
                            vec3.transformMat4(curvePoint, curvePoint, instanceEdge.instanceMat);
                            closestCandidate = {
                                entity: {
                                    ObjectId: pickInterface.objectId,
                                    drawKind: "edge",
                                    pathIndex: edge.idx,
                                    instanceIndex: instanceEdge.instanceIdx,
                                    parameter: t,
                                },
                                connectionPoint: curvePoint
                            };
                        }
                    }
                }
            }
        }
    }

    if (closestCandidate) {
        return closestCandidate;
    }

    if (faceTolerance) {
        const closestSurface = closestCandiateOnSurfaces(pickInterface, position, faceTolerance);
        if (closestSurface) {
            return closestSurface;
        }
        const closestFace = closestCandiateOnPolyMeshSurface(pickInterface, position, faceTolerance);
        if (closestFace) {
            return closestFace;
        }
    }
    if (pointTolerance) {
        return closestSnappingPoints(pickInterface, position, pointTolerance, false);
    }

    return undefined;
}