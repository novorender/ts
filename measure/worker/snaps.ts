import type { ReadonlyMat4, ReadonlyVec3 } from "gl-matrix";
import { mat4, vec2, vec3 } from "gl-matrix";
import type { AABB3, EdgeData, ProductData } from "./brep";
import { isInsideAABB } from "./calculations";
import type { Line3D, Arc3D, NurbsCurve3D, LineStrip3D, Curve3D } from "./curves";
import { crawlInstance, matFromInstance, unitToScale } from "./loader";
import type { Surface } from "./surfaces";
import type { SnapTolerance } from "measure/modules";
import type { MeasureEntity } from "measure/measure_view";
import { MeasureTool } from "./scene";

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

export interface FacePickInfo {
    idx: number;
    aabb: AABB3;
    surface: Surface;
}

export interface PickFaces extends EntityPicker {
    instanceMat: ReadonlyMat4;
    faces: FacePickInfo[];
}

export interface PickInterface {
    objectId: number;
    unitScale: number;
    segments: PickSegments[];
    edges: PickEdges[];
    faces: PickFaces[];
}

export async function getPickInterface(product: ProductData, objectId: number): Promise<PickInterface> {
    const edgeInstances = new Array<Array<number>>(product.instances.length);
    const faceInstances = new Array<Array<number>>(product.instances.length);
    const curveSegmentInstances = new Array<readonly number[]>(
        product.instances.length
    );

    for (let i = 0; i < product.instances.length; ++i) {
        const instanceData = product.instances[i];

        const edges = new Array<number>();
        const faces = new Array<number>();

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
                    }
                }
            }
        }

        if (typeof instanceData.geometry == "number") {
            //check geom is number
            crawlInstance(product, instanceData, faceFunc);
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

    const faces: PickFaces[] = [];
    for (let i = 0; i < faceInstances.length; ++i) {
        const InstanceData = product.instances[i];
        const instanceMat = matFromInstance(InstanceData);
        const worldToObject = mat4.invert(mat4.create(), instanceMat);
        const surfaces: FacePickInfo[] = [];
        for (const faceIdx of faceInstances[i]) {
            const faceData = product.faces[faceIdx];
            const surfaceData = product.surfaces[faceData.surface];
            const surface = MeasureTool.geometryFactory.getSurface(surfaceData, 1);
            surfaces.push({ aabb: faceData.aabb, idx: faceIdx, surface: surface as Surface })
        }
        faces.push({ instanceIdx: i, worldToObject, faces: surfaces, instanceMat });
    }

    return { objectId, edges, segments, faces, unitScale: unitToScale(product.units) };
}

export function pick(pickInterface: PickInterface, position: ReadonlyVec3, tolerance: SnapTolerance): { entity: MeasureEntity, connectionPoint: vec3 } | undefined {
    const flippedPos = vec3.copy(vec3.create(), position);
    const edgeTolerance = tolerance.edge ? tolerance.edge / pickInterface.unitScale : undefined;
    const segmentTolerance = tolerance.segment ? tolerance.segment / pickInterface.unitScale : undefined;
    const faceTolerance = tolerance.face ? tolerance.face / pickInterface.unitScale : undefined;
    const pointTolerance = tolerance.point ? tolerance.point / pickInterface.unitScale : undefined;

    if (segmentTolerance) {
        for (const instanceSeg of pickInterface.segments) {
            const localPoint = vec3.transformMat4(
                vec3.create(),
                flippedPos,
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
                flippedPos,
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
        for (const faceInstance of pickInterface.faces) {
            const localPoint = vec3.transformMat4(
                vec3.create(),
                flippedPos,
                faceInstance.worldToObject
            );
            for (const face of faceInstance.faces) {
                if (isInsideAABB(localPoint, face.aabb, faceTolerance)) {
                    const uv = vec2.create();
                    face.surface.invert(uv, localPoint);
                    const surfacePoint = vec3.create();
                    face.surface.evalPosition(surfacePoint, uv);

                    const dist = vec3.dist(surfacePoint, localPoint);
                    if (dist < closestDistance && dist < faceTolerance) {
                        vec3.transformMat4(surfacePoint, surfacePoint, faceInstance.instanceMat);
                        closestCandidate = {
                            entity: {
                                ObjectId: pickInterface.objectId,
                                drawKind: "face",
                                pathIndex: face.idx,
                                instanceIndex: faceInstance.instanceIdx,
                                parameter: uv,
                            },
                            connectionPoint: surfacePoint
                        };
                        closestDistance = dist;
                    }
                }
            }
        }
    }
    return closestCandidate;
}