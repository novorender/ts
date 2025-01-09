import { mat4, glMatrix, vec2, vec3 } from "gl-matrix";
// import cubeJson from "../public/cube.json";
// import cylinderJson from "../public/cylinder.json";
// import coneJson from "../public/cone.json";
// import tubeJson from "../public/tube.json";
import { Arc2D, Line2D, Line3D, LineStrip3D, NurbsCurve2D, NurbsCurve3D } from "./curves";
import { Arc3D, type Curve2D, type Curve3D } from "./curves";
import { Face, type Seam } from "./face";
import type {
    ProductData,
    IndexPair,
    SurfaceData,
    FaceData,
    InstanceData,
    AABB2,
    CurveSegmentData,
    EdgeData,
} from "./brep";
import { Cone, Cylinder, Nurbs, Plane, type Surface, Torus } from "./surfaces";
import { Edge } from "./edge";
// @ts-ignore
import factory from "../wasm/nurbs_wrapper.js";

glMatrix.setMatrixArrayType(Array);

export function matFromInstance(instance: InstanceData): mat4 {
    if (instance.transformation !== undefined) {
        return mat4.fromValues(
            ...(instance.transformation as Parameters<typeof mat4.fromValues>)
        );
    }
    return mat4.identity(mat4.create());
}

export function unitToScale(unit: string) {
    switch (unit) {
        case "mm":
            return 1 / 1000;
        case "cm":
            return 1 / 100;
        case "in":
            return 0.0254;
        default:
            return 1;
    }
}

export async function createGeometryFactory(wasmUrl: string | ArrayBuffer) {
    const factoryArg = typeof wasmUrl == "string" ?
        { locateFile: (path: string) => wasmUrl } :
        { wasmBinary: wasmUrl };
    // { getPreloadedPackage: (remotePackageName: string, remotePackageSize: number) => wasmUrl};
    const wasmInstance = await factory(factoryArg);
    var dataPtr = wasmInstance._malloc(48);
    var dataHeap = new Float64Array(wasmInstance.HEAPF64.buffer, dataPtr, 6);
    return new GeometryFactory(wasmInstance, dataHeap);
}

export function crawlInstance(
    product: ProductData,
    instanceData: InstanceData,
    faceFunc: (faceIdx: number) => void,
    snappingPointFunc: (snapIdx: number) => void,
) {
    const geometryData = product.geometries[instanceData.geometry as number];
    if (geometryData.shells) {
        for (const shellIdx of geometryData.shells) {
            const shell = product.shells[shellIdx];
            for (const faceIdx of shell.faces) {
                faceFunc(faceIdx);
            }
            if (shell.snappingPoints) {
                for (const snapIdx of shell.snappingPoints) {
                    snappingPointFunc(snapIdx);
                }
            }
        }
    }
    if (geometryData.solids) {
        for (const solidIdx of geometryData.solids) {
            const solid = product.solids[solidIdx];
            for (const faceIdx of product.shells[solid.outerShell].faces) {
                faceFunc(faceIdx);
            }
            const shellSnaps = product.shells[solid.outerShell].snappingPoints;
            if (shellSnaps) {
                for (const snapIdx of shellSnaps) {
                    snappingPointFunc(snapIdx);
                }
            }
            if (solid.innerShells) {
                for (const innerShellIdx of solid.innerShells) {
                    const shell = product.shells[innerShellIdx];
                    for (const faceIdx of shell.faces) {
                        faceFunc(faceIdx);
                    }
                    if (shell.snappingPoints) {
                        for (const snapIdx of shell.snappingPoints) {
                            snappingPointFunc(snapIdx);
                        }
                    }
                }
            }
        }
    }
}

export class GeometryFactory {
    constructor(
        private readonly wasmInstance: any,
        private readonly buffer: Float64Array
    ) { }

    getCurve2D(data: ProductData, halfEdgeIndex: number): Curve2D | undefined {
        const halfEdgeData = data.halfEdges[halfEdgeIndex];
        if (halfEdgeData.curve2D == undefined) {
            return undefined;
        }
        let [beginParam, endParam] = halfEdgeData.parameterBounds;
        let sense: 1 | -1 = 1;
        if (halfEdgeData.direction < 0) {
            sense = -1; // this is only used for negating tangents.
            [beginParam, endParam] = [endParam, beginParam]; // flip parameters
        }
        const curveData = data.curves2D[halfEdgeData.curve2D];
        switch (curveData.kind) {
            case "line": {
                const origin = vec2.fromValues(
                    ...(curveData.origin as Parameters<typeof vec2.fromValues>)
                );
                const direction = vec2.fromValues(
                    ...(curveData.direction as Parameters<typeof vec2.fromValues>)
                );
                return new Line2D(origin, direction, beginParam, endParam, sense);
            }
            case "circle": {
                const origin = vec2.fromValues(
                    ...(curveData.origin as Parameters<typeof vec2.fromValues>)
                );
                const { radius } = curveData;
                return new Arc2D(origin, radius, beginParam, endParam, sense);
            }
            case "nurbs": {
                const { order, controlPoints, knots, weights } = curveData;
                return new NurbsCurve2D(
                    order,
                    controlPoints,
                    knots,
                    weights,
                    beginParam,
                    endParam,
                    sense,
                    this.wasmInstance,
                    this.buffer
                );
            }
            default:
                throw Error(`Unsupported curve type!`);
        }
    }

    getCurve3D(data: ProductData, halfEdgeIndex: number): Curve3D | undefined {
        const halfEdgeData = data.halfEdges[halfEdgeIndex];
        return this.getCurve3DFromEdge(
            data,
            halfEdgeData.edge,
            halfEdgeData.direction
        );
    }

    getHalfEdgeAABB(data: ProductData, halfEdgeIndex: number): AABB2 | undefined {
        const halfEdgeData = data.halfEdges[halfEdgeIndex];
        if (halfEdgeData.aabb) {
            return halfEdgeData.aabb;
        }

        const curve = this.getCurve2D(data, halfEdgeIndex);
        if (!curve) {
            return undefined;
        }
        const points: vec2[] = [];

        switch (curve.kind) {
            case "line":
                points.push(vec2.create());
                points.push(vec2.create());
                curve.eval(curve.beginParam, points[0], undefined);
                curve.eval(curve.endParam, points[1], undefined);
                break;
            case "arc":
                points.push(vec2.create());
                points.push(vec2.create());
                curve.eval(curve.beginParam, points[0], undefined);
                curve.eval(curve.endParam, points[1], undefined);
                const paramOffset = curve.endParam > 2 * Math.PI ? -Math.PI * 2 : 0;
                for (let i = 1; i < 4; ++i) {
                    const param = (Math.PI / 2) * i + paramOffset;
                    if (param >= curve.beginParam && param <= curve.endParam) {
                        const point = vec2.create();
                        curve.eval(param, point, undefined);
                        points.push(point);
                    }
                }
                break;
            //TODO begin and end + max 4 tangents coords
            default:
                return undefined;
        }
        const min = vec2.copy(vec2.create(), points[0]);
        const max = vec2.copy(vec2.create(), points[0]);
        for (let i = 1; i < points.length; ++i) {
            vec2.min(min, min, points[i]);
            vec2.max(max, max, points[i]);
        }
        return { min, max };
    }

    private getCurve3DFromEdgeOrSegment(
        data: ProductData,
        segmentData: CurveSegmentData | EdgeData
    ) {
        if (segmentData.curve3D != undefined) {
            let [beginParam, endParam] = segmentData.parameterBounds;
            const curveData = data.curves3D[segmentData.curve3D];
            switch (curveData.kind) {
                case "line": {
                    const origin = vec3.fromValues(
                        ...(curveData.origin as Parameters<typeof vec3.fromValues>)
                    );
                    const direction = vec3.fromValues(
                        ...(curveData.direction as Parameters<typeof vec3.fromValues>)
                    );
                    return new Line3D(
                        origin,
                        direction,
                        beginParam,
                        endParam,
                        1,
                        segmentData.tesselationParameters
                    );
                }
                case "circle": {
                    const origin = vec3.fromValues(
                        ...(curveData.origin as Parameters<typeof vec3.fromValues>)
                    );
                    const { radius, axisX, axisY } = curveData;
                    return new Arc3D(
                        origin,
                        axisX,
                        axisY,
                        radius,
                        beginParam,
                        endParam,
                        1,
                        segmentData.tesselationParameters
                    );
                }
                case "nurbs": {
                    const { order, controlPoints, knots, weights } = curveData;
                    return new NurbsCurve3D(
                        order,
                        controlPoints,
                        knots,
                        weights,
                        beginParam,
                        endParam,
                        1,
                        segmentData.tesselationParameters,
                        this.wasmInstance,
                        this.buffer
                    );
                }
                case "lineStrip": {
                    return new LineStrip3D(
                        curveData.vertices,
                        beginParam,
                        endParam,
                        segmentData.tesselationParameters
                    );
                }
                default:
                    throw Error(`Unsupported curve type!`);
            }
        }
    }

    getCurve3DFromSegment(data: ProductData, segmentIndex: number) {
        if (data.curveSegments && segmentIndex < data.curveSegments.length) {
            return this.getCurve3DFromEdgeOrSegment(
                data,
                data.curveSegments[segmentIndex]
            );
        }
    }

    getCurve3DFromEdge(
        data: ProductData,
        edgeIndex: number,
        sense: 1 | -1 = 1
    ): Curve3D | undefined {
        return this.getCurve3DFromEdgeOrSegment(data, data.edges[edgeIndex]);
    }

    getSurface(data: SurfaceData, sense: -1 | 1, scale?: number): Surface {
        switch (data.kind) {
            case "plane": {
                const transform = mat4.fromValues(
                    ...(data.transform as Parameters<typeof mat4.fromValues>)
                );
                return new Plane(transform, sense, scale);
            }
            case "cylinder": {
                const transform = mat4.fromValues(
                    ...(data.transform as Parameters<typeof mat4.fromValues>)
                );
                return new Cylinder(data.radius, transform, sense, scale);
            }
            case "cone": {
                const transform = mat4.fromValues(
                    ...(data.transform as Parameters<typeof mat4.fromValues>)
                );
                return new Cone(
                    data.radius,
                    data.halfAngleTan,
                    transform,
                    sense,
                    scale
                );
            }
            case "torus": {
                const transform = mat4.fromValues(
                    ...(data.transform as Parameters<typeof mat4.fromValues>)
                );
                return new Torus(
                    data.majorRadius,
                    data.minorRadius,
                    transform,
                    sense,
                    scale
                );
            }
            case "nurbs": {
                return new Nurbs(
                    data.orders,
                    data.dim,
                    data.controlPoints,
                    data.knots,
                    data.weights,
                    sense,
                    this.wasmInstance,
                    this.buffer,
                    scale
                );
            }
            default:
                throw Error(`Unsupported surface type!`);
        }
    }

    makeFace(
        face: FaceData,
        instance: InstanceData,
        instanceIndex: number,
        product: ProductData,
        curves2D: Curve2D[]
    ) {
        if (face.surface === undefined) {
            return undefined;
        }
        const loops = [face.outerLoop, ...(face.innerLoops ?? [])];
        const virtualEdges = new Set<number>();
        const faceCurves2D = loops.map((l) => {
            return product.loops[l].halfEdges.map((e) => {
                const halfEdge = product.halfEdges[e];
                const edgeIndex = halfEdge.edge;
                const edge = product.edges[edgeIndex];
                if (edge.virtual) {
                    virtualEdges.add(edgeIndex);
                }
                return curves2D[e];
            });
        });
        const seams: Seam[] = [];
        for (const ei of virtualEdges) {
            const edge = product.edges[ei];
            const [a, b] = edge.halfEdges;
            if (b != null) {
                console.assert(product.halfEdges[a].face == product.halfEdges[b].face); // confirm that this is indeed a virtual edge.
                const ia = product.halfEdges[a].faceVertexIndices;
                const ib = product.halfEdges[b].faceVertexIndices;
                console.assert(ia.length == ib.length);
                // mark pairs of vertices on opposite side of virtual edge to be merged into one
                const vertexIndexPairs: IndexPair[] = [];
                for (let i = 0; i < ia.length; i++) {
                    // vertexIndexPairs.push([ia[i], ib[ib.length - i - 1]]);
                    vertexIndexPairs.push([ia[i], ib[i]]);
                }
                seams.push({ vertexIndexPairs });
            }
        }
        const surface = this.getSurface(
            product.surfaces[face.surface],
            face.facing
        );
        return new Face(
            surface,
            face.facing,
            faceCurves2D,
            face.triangulation,
            seams,
            instanceIndex,
            instance.transformation ? matFromInstance(instance) : undefined
        );
    }

    getFaces(product: ProductData) {
        const curves2D: Curve2D[] = [];
        for (let i = 0; i < product.halfEdges.length; ++i) {
            const curve = this.getCurve2D(product, i);
            if (curve) {
                curves2D.push(curve);
            }
        }
        const faces: Face[] = [];

        if (curves2D.length == 0) {
            return faces;
        }
        for (let i = 0; i < product.instances.length; ++i) {
            const instance = product.instances[i];

            const faceFunc = (faceIdx: number) => {
                const face = this.makeFace(product.faces[faceIdx], instance, i, product, curves2D);
                if (face) {
                    faces.push(face);
                }

            };

            if (typeof instance.geometry == "number") {
                //check geom is number
                crawlInstance(product, instance, faceFunc, () => { });
            }
        }

        return faces;
    }

    getCurvesFromEdges(product: ProductData, edgeInstances: number[]) {
        const curves = new Array<Edge | undefined>();
        for (let i = 0; i < product.edges.length; ++i) {
            const curve = this.getCurve3DFromEdge(product, i);
            const edgeData = product.edges[i];
            if (curve && !edgeData.virtual) {
                const instance = product.instances[edgeInstances[i]];
                const transform = mat4.create();
                if (instance.transformation) {
                    mat4.mul(transform, transform, matFromInstance(instance));
                }
                curves.push(new Edge(curve, transform, edgeInstances[i]));
            } else {
                curves.push(undefined);
            }
        }
        return curves;
    }

    getEdges(product: ProductData) {
        const edgeInstances = new Array<number>(product.edges.length);

        for (let i = 0; i < product.instances.length; ++i) {
            const addFaceEdges = (faceIdx: number) => {
                const face = product.faces[faceIdx];
                const loops = [face.outerLoop, ...(face.innerLoops ?? [])];
                for (const loopIdx of loops) {
                    const loop = product.loops[loopIdx];
                    for (const halfEdgeIdx of loop.halfEdges) {
                        const halfEdge = product.halfEdges[halfEdgeIdx];
                        edgeInstances[halfEdge.edge] = i;
                    }
                }
            };

            const instance = product.instances[i];
            if (typeof instance.geometry == "number") {
                //check geom is number
                crawlInstance(product, instance, addFaceEdges, () => { });
            }
        }
        return this.getCurvesFromEdges(product, edgeInstances);
    }
}
