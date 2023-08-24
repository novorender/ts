/*
precomputation:
for each body
    compute vertex positions, normals, tangents etc - as needed
    (compute triangle normals)
    create edge topology map


build list of forward facing polygons (from faces)
for each (other) poly
  intersect with subject
  if intersect is not empty and intersection lies in front of subject
     subtract intersection from subject poly


per camera angle:
project 3D points onto 2D image plane using fixed point integers for robust intersection tests (but retain z component for depth tests)
determine triangle facings/windings
for each edge
    if outline edge (has both a forward and backward facing triangle attached)
        store edge in list of outline edges (possibly using some sort of accelleration structure)
for each triangle
    if facing forward
        for each triangle edge
            does any edge edge intersect outline edges that lies in front of triangle?
                yes: split edges into visible and hidden portions
                    also sever topological connection to create triangle islands
                    store visibility info in each triangle half



how about we just found the outline polygons for each face?
  only consider forward facing triangles
  then we slice it by all other outline polygons and test visibility of each sub poly


js: https://github.com/mfogel/polygon-clipping (uses floats and gets rounding problems, but might do for a quick prototype)
c++: https://github.com/Geri-Borbas/Clipper (uses large ints, but possibly a little out of date and not sure we can extract all subregions)
c++: https://www.boost.org/doc/libs/1_72_0/libs/polygon/doc/gtl_polygon_set_concept.htm (uses ints or snapped floats. made by intel, but old'ish. flexible interface with potentially useful functions for LOD etc.)

*/

import type { ReadonlyMat4, ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import { mat3, glMatrix, vec2, vec3 } from "gl-matrix";
import type { Face } from "./face";
import type { Triangulation } from "./brep";
import type { Surface } from "./surfaces";
import type { Edge } from "./edge";
import type { Curve3D } from "./curves";

glMatrix.setMatrixArrayType(Array);

const epsilon = 1e-4;

interface Topology {
    readonly triangles: readonly Triangle[];
    readonly vertices: readonly SurfaceVertex[];
    readonly edges: readonly EdgeInfo[];
}

type Index = number;
type IndexPair = readonly [Index, Index];
type IndexTriplet = readonly [Index, Index, Index];
type EdgeKey = bigint;

type SurfaceVertex = {
    pos: ReadonlyVec3;
    uv: ReadonlyVec2; // parametric uv coord
    normal: ReadonlyVec3;
};

type EdgeVertex = {
    pos: ReadonlyVec3;
    t: number;
    tangent: ReadonlyVec3;
};

interface EdgeInfo {
    readonly vertices: IndexPair; // pair of vertex indices
    readonly triangles: readonly [Index] | [Index, Index]; // pair of triangle indices (if last one is 0, then the edge is non-manifold)
}

interface Triangle {
    readonly vertices: IndexTriplet;
    readonly edges: IndexTriplet; // negative indices indicates that the edge direction is reversed, i.e. this is the second triangle that refer to it.
    readonly normal: ReadonlyVec3;
}

interface Strip {
    startEdge: number;
    endEdge: number; // parametric uv coord
    strip: ReadonlyVec3[];
}

function constructEdgeKey(a: number, b: number): EdgeKey {
    if (a > b) {
        [b, a] = [a, b];
    }
    return BigInt(a) | (BigInt(b) << 32n);
}

function deconstructEdgeKey(edgeKey: EdgeKey): readonly [number, number] {
    const a = Number(BigInt.asUintN(32, edgeKey));
    const b = Number(BigInt.asUintN(32, edgeKey >> 32n));
    return [a, b] as const;
}

function evalTriangulation(surface: Surface, triangulation: Triangulation, productMatrix?: ReadonlyMat4) {
    const vertices: SurfaceVertex[] = [];
    const productNormalMatrix = productMatrix ? mat3.normalFromMat4(mat3.create(), productMatrix) : undefined;
    for (let i = 0; i < triangulation.vertices.length; i += 2) {
        // const uv = triangulation.vertices.slice(i, i + 2) as unknown as readonly [number, number];
        const uv = vec2.fromValues(triangulation.vertices[i], triangulation.vertices[i + 1]);
        const pos = vec3.create();
        const normal = vec3.create();
        surface.evalPosition(pos, uv);
        surface.evalNormal(normal, uv);
        if (productMatrix && productNormalMatrix) {
            //const rotMat = mat3.fromMat4(mat3.create(), productMatrix);
            vec3.transformMat4(pos, pos, productMatrix);
            //vec3.transformMat3(pos, pos, rotMat);
            vec3.transformMat3(normal, normal, productNormalMatrix);
            vec3.normalize(normal, normal);
        }
        vertices.push({ pos, uv, normal });
    }
    return vertices;
}

function evalTesselation(curve: Curve3D, transform: ReadonlyMat4) {
    const vertices: EdgeVertex[] = [];
    const normalMat = mat3.normalFromMat4(mat3.create(), transform);
    for (const t of curve.tesselationParameters) {
        const pos = vec3.create();
        const tangent = vec3.create();
        curve.eval(t, pos, tangent);

        vec3.transformMat4(pos, pos, transform);
        vec3.transformMat3(tangent, tangent, normalMat);
        vec3.normalize(tangent, tangent);

        vertices.push({ pos, t, tangent });
    }
    return vertices;
}

function createTopology(face: Face): Topology {
    const edges: EdgeInfo[] = [];
    const edgeMap = new Map<bigint, number>();
    const triangles: Triangle[] = [];
    const { surface, triangulation } = face;

    const vertices = evalTriangulation(surface, triangulation, face.geometryTransformation);

    const vertexRemap = vertices.map((_, i) => i);
    for (const seam of face.seams) {
        for (const [a, b] of seam.vertexIndexPairs) {
            vertexRemap[b] = a;
            console.assert(vec3.distance(vertices[a].pos, vertices[b].pos) < 1e-4);
        }
    }

    const { indices } = triangulation;
    for (let i = 0; i < indices.length; i += 3) {
        const triangleIndex = triangles.length;
        const vi = indices.slice(i, i + 3).map((vi) => vertexRemap[vi]);
        if (face.sense == -1) {
            vi.reverse();
        }
        const [v0, v1, v2] = vi;

        const ab = vec3.subtract(vec3.create(), vertices[v1].pos, vertices[v0].pos);
        const ac = vec3.subtract(vec3.create(), vertices[v2].pos, vertices[v0].pos);

        const normal = vec3.create();
        vec3.cross(normal, ab, ac);
        const l2 = vec3.dot(normal, normal);
        if (l2 == 0) continue; // skip degenerate triangles
        vec3.normalize(normal, normal);

        console.assert(vec3.dot(normal, vertices[v0].normal) > 0);
        console.assert(vec3.dot(normal, vertices[v1].normal) > 0);
        console.assert(vec3.dot(normal, vertices[v2].normal) > 0);

        function addEdge(v0: number, v1: number) {
            const key = constructEdgeKey(v0, v1);
            let edgeIndex = edgeMap.get(key);
            if (undefined === edgeIndex) {
                edgeIndex = edges.length;
                edgeMap.set(key, edgeIndex);
                edges.push({
                    vertices: [v0, v1],
                    triangles: [triangleIndex],
                });
            } else {
                const { triangles } = edges[edgeIndex];
                console.assert(triangles.length == 1);
                (<[Index]>edges[edgeIndex].triangles).push(triangleIndex);
                edgeIndex = edgeIndex;
            }
            return edgeIndex;
        }
        const e0 = addEdge(v0, v1);
        const e1 = addEdge(v1, v2);
        const e2 = addEdge(v2, v0);

        const p0 = vertices[v0].pos;
        const p1 = vertices[v1].pos;
        const p2 = vertices[v2].pos;

        const triangle: Triangle = {
            vertices: [v0, v1, v2] as const,
            edges: [e0, e1, e2] as const,
            normal,
        } as const;
        triangles.push(triangle);
    }

    return {
        triangles,
        vertices,
        edges,
    };
}

function triangleWinding(indices: readonly [number, number, number], vertices: readonly ReadonlyVec3[]) {
    const [ia, ib, ic] = indices;
    const [ax, ay] = vertices[ia];
    const [bx, by] = vertices[ib];
    const [cx, cy] = vertices[ic];
    const x1 = bx - ax;
    const y1 = by - ay;
    const x2 = cx - ax;
    const y2 = cy - ay;
    const cp = x1 * y2 - y1 * x2;
    return cp > 0 ? 1 : -1;
}

function triangleVertexFacing(indices: readonly [number, number, number], normals: readonly ReadonlyVec3[]) {
    const [ia, ib, ic] = indices;
    const az = normals[ia][2];
    const bz = normals[ib][2];
    const cz = normals[ic][2];
    if (az > epsilon && bz > epsilon && cz > epsilon) {
        return 1;
    } else if (az < epsilon && bz < epsilon && cz < epsilon) {
        return -1;
    }
    return 0;
}

function edgeVertexStraddling(indices: readonly [number, number], normals: readonly ReadonlyVec3[]) {
    const [ia, ib] = indices;
    const az = normals[ia][2];
    const bz = normals[ib][2];
    if (az > epsilon && bz > epsilon) {
        return 0;
    } else if (az < epsilon && bz < epsilon) {
        return 0;
    }
    return Math.sign(az - bz);
}

function edgeVertexFacing(indices: readonly [number, number], normals: readonly ReadonlyVec3[]) {
    const [ia, ib] = indices;
    const az = normals[ia][2];
    const bz = normals[ib][2];
    if (az > epsilon && bz > epsilon) {
        return 1;
    } else if (az < epsilon && bz < epsilon) {
        return -1;
    }
    return 0;
}

function edgeStraddleParameter(indices: readonly [number, number], normals: readonly ReadonlyVec3[]) {
    const [ia, ib] = indices;
    const az = normals[ia][2];
    const bz = normals[ib][2];
    let t = (az - epsilon) / (az - bz);
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

export type PathInfo = { path: string; centerDepth: number; originalIndex: number; instanceIndex: number; kind: "edge" | "face" };

export function getEdgeStrip(edge: Edge, sense: number): ReadonlyVec3[] {
    const v = evalTesselation(edge.curve, edge.geometryTransformation).map((v) => v.pos);
    return sense > 0 ? v : v.reverse();
}

export function getBrepEdges(edges: readonly (Edge | undefined)[], worldViewMatrix: ReadonlyMat4): PathInfo[] {
    const paths: PathInfo[] = [];
    for (let i = 0; i < edges.length; ++i) {
        const edge = edges[i];
        if (!edge) {
            continue;
        }
        const vertices = evalTesselation(edge.curve, edge.geometryTransformation);
        const verticiesVS = vertices.map((v) => vec3.transformMat4(vec3.create(), v.pos, worldViewMatrix));
        const pathParts: string[] = [];
        let [x, y] = verticiesVS[0];
        pathParts.push(`M ${x} ${y}`);
        for (let i = 1; i < vertices.length; ++i) {
            [x, y] = verticiesVS[i];
            pathParts.push(`L ${x} ${y}`);
        }
        const path = pathParts.join(" ");
        //TODO: Check if closed

        paths.push({ path, centerDepth: 0, originalIndex: i, instanceIndex: edge.instanceIndex, kind: "edge" });
    }
    return paths;
}

export function getBrepFaces(faces: readonly Face[], worldViewMatrix: ReadonlyMat4): PathInfo[] {
    // const towardsCamera = camera.backward;

    const paths: PathInfo[] = [];

    for (let i = 0; i < faces.length; ++i) {
        const face = faces[i];
        const { loops } = getProjectedLoops(face, worldViewMatrix);

        // const loops = triangles.filter((t, i) => triangleFacings[i] > 0).map(t => t.vertices);

        // create rendercontext path from loops
        // const path = new Path2D();
        let minDepth = Number.MAX_VALUE;
        let maxDepth = Number.MIN_VALUE;
        const pathParts: string[] = [];

        function polygonWinding(loop: readonly ReadonlyVec3[]) {
            let totalArea = 0;
            for (let i = 0; i < loop.length; ++i) {
                const a = loop[i];
                const b = loop[(i + 1) % loop.length];
                const cp = (b[0] - a[0]) * (b[1] + a[1]);
                //const cp = a[0] * b[1] - a[1] * b[0];
                totalArea += cp;
            }
            console.assert(totalArea != 0);
            return Math.sign(totalArea) as 1 | -1;
        }

        function endPath() {
            const path = pathParts.join(" ");
            const centerDepth = (minDepth + maxDepth) / 2;
            paths.push({ path, centerDepth, originalIndex: i, instanceIndex: face.instanceIndex, kind: "face" });
        }

        const windings: number[] = [];

        for (const loopWS of loops) {
            const loopVS = loopWS.map((v) => vec3.transformMat4(vec3.create(), v, worldViewMatrix));
            const winding = -polygonWinding(loopVS);
            windings.push(winding);
            //todo winding > 0 more than one split loops
            for (const v of loopVS) {
                const depth = v[2];
                if (minDepth > depth) {
                    minDepth = depth;
                }
                if (maxDepth < depth) {
                    maxDepth = depth;
                }
            }
            const [x, y] = loopVS[loopVS.length - 1];
            pathParts.push(`M ${x} ${y}`);
            for (const v of loopVS) {
                const [x, y] = v;
                pathParts.push(`L ${x} ${y}`);
            }
        }

        endPath();
    }

    return paths;
}

function getContourEdges(topology: Topology, normalsVS: readonly ReadonlyVec3[]) {
    const { edges, triangles, vertices } = topology;

    const edgeStraddle = edges.map((e) => edgeVertexStraddling(e.vertices, normalsVS));
    const straddlingTriangleIndices = triangles.map((t, i) => i).filter((i) => triangleVertexFacing(triangles[i].vertices, normalsVS) == 0);
    const remainingTriangles = new Set<number>(straddlingTriangleIndices);

    const straddlePoints = edges.map((e, i) => {
        if (edgeStraddle[i] == 0) {
            return undefined;
        }
        const t = edgeStraddleParameter(e.vertices, normalsVS);
        const va = vertices[e.vertices[0]];
        const vb = vertices[e.vertices[1]];
        return vec3.lerp(vec3.create(), va.pos, vb.pos, t) as ReadonlyVec3;
    });

    function traverseContourEdges(edge: number) {
        const edgeStrip: number[] = [];
        edgeStrip.push(edge);
        let currentEdge = edge;
        let run = true;
        while (run) {
            run = false;
            for (const triangleIndex of edges[currentEdge].triangles) {
                if (remainingTriangles.delete(triangleIndex)) {
                    const triangle = triangles[triangleIndex];
                    const straddleEdges = triangle.edges.filter((i) => edgeStraddle[i] != 0 && i != currentEdge);
                    console.assert(straddleEdges.length == 1);
                    currentEdge = straddleEdges[0];
                    edgeStrip.push(currentEdge);
                    run = true;
                    break;
                }
            }
        }
        return edgeStrip;
    }

    function isContourLoop(edgeStart: number, edgeEnd: number) {
        const start = edges[edgeStart].triangles;
        const end = edges[edgeEnd].triangles;
        return start.some((i) => end.some((j) => j == i));
    }

    function createStripFromStraddleEdges(loop: number[]) {
        const strip: ReadonlyVec3[] = [];
        for (const index of loop) {
            strip.push(straddlePoints[index]!);
        }
        return strip;
    }

    const strips: number[][] = [];
    const loops: ReadonlyVec3[][] = [];

    while (remainingTriangles.size > 0) {
        const keys = [...remainingTriangles.keys()];
        //const triangleIndex = keys[Math.floor(Math.random() * keys.length)];
        const triangleIndex = remainingTriangles.keys().next().value as number;
        remainingTriangles.delete(triangleIndex);

        const triangle = triangles[triangleIndex];
        const triangleEdges = triangle.edges;
        const straddleEdges = triangleEdges.filter((i) => edgeStraddle[i] != 0);
        straddleEdges.sort((a, b) => edgeStraddle[a] - edgeStraddle[b]);

        const leftStrip = traverseContourEdges(straddleEdges[0]);
        const rightStrip = traverseContourEdges(straddleEdges[1]);
        const combinedStrip = [...rightStrip.reverse(), ...leftStrip];
        if (isContourLoop(combinedStrip[0], combinedStrip[combinedStrip.length - 1])) {
            loops.push(createStripFromStraddleEdges(combinedStrip));
        } else {
            strips.push(combinedStrip);
        }
    }

    const contourStrips = strips.map((s) => {
        return { startEdge: s[0], endEdge: s[s.length - 1], strip: s.map((i) => straddlePoints[i]!) };
    });

    return { loops, contourStrips };
}

function getTrimEdges(topology: Topology, normalsVS: readonly ReadonlyVec3[], facing: number = 1) {
    const { edges } = topology;
    const edgeFacing = edges.map((e) => edgeVertexFacing(e.vertices, normalsVS));

    const edgeIndices = edges.map((e, i) => i);
    const trimEdgeIndices = edgeIndices.filter((i) => edges[i].triangles.length === 1 && edgeFacing[i] * facing >= 0);
    return trimEdgeIndices;
}

function getTrimStrips(topology: Topology, normalsVS: readonly ReadonlyVec3[]) {
    const { edges, vertices } = topology;

    const trimEdgeIndices = getTrimEdges(topology, normalsVS);

    const trimEdgesMap = new Map<number, [number, number]>();

    const edgeReferences = new Array<number>(edges.length).fill(0);
    for (const trimEdgeIndex of trimEdgeIndices) {
        const trimEdge = edges[trimEdgeIndex];
        let [va, vb] = trimEdge.vertices;
        console.assert(!trimEdgesMap.has(va));
        ++edgeReferences[va];
        --edgeReferences[vb];
        trimEdgesMap.set(va, [vb, trimEdgeIndex]);
    }

    const beginEdges = edgeReferences.map((count, index) => ({ index, count })).filter((e) => e.count == 1);

    const trimLoops: ReadonlyVec3[][] = [];
    const trimStrips: Strip[] = [];
    function traverseEdges(startKey: number) {
        let strip: ReadonlyVec3[] = [];
        let head = startKey;
        const value = trimEdgesMap.get(head)!;
        const startEdge = value[1];
        let endEdge = value[1];
        do {
            strip.push(vertices[head].pos);
            const tail = head;
            const value = trimEdgesMap.get(tail) as [number, number];
            trimEdgesMap.delete(tail);
            if (value === undefined) {
                break;
            }
            head = value[0];
            endEdge = value[1];
            console.assert(strip.length < 100000); // infinite loop?
        } while (head != startKey);
        if (head == startKey) {
            endEdge = startEdge;
            return { kind: "loop", strip } as const;
        } else {
            strip = strip.slice(1, strip.length - 1);
        }
        return { kind: "strip", startEdge, endEdge, strip } as const;
    }

    for (const beginEdge of beginEdges) {
        const strip = traverseEdges(beginEdge.index);
        if (strip.kind === "strip") {
            trimStrips.push(strip);
        } else {
            console.assert(false);
        }
    }

    while (trimEdgesMap.size > 0) {
        const key = trimEdgesMap.keys().next().value as number;
        const { kind, strip } = traverseEdges(key);
        trimLoops.push(strip);
        console.assert(kind == "loop");
    }
    return { trimLoops, trimStrips };
}

function* loopsFromStrips(combinedStrips: Strip[]) {
    while (combinedStrips.length > 0) {
        const loop: ReadonlyVec3[] = [];
        let current = combinedStrips.pop()!;
        const loopStartEdge = current.startEdge;
        loop.push(...current.strip);
        for (; ;) {
            let foundIndex: number | undefined = undefined;
            for (let i = 0; i < combinedStrips.length; ++i) {
                const { startEdge } = combinedStrips[i];
                if (startEdge == current.endEdge) {
                    foundIndex = i;
                    break;
                }
            }
            if (foundIndex !== undefined) {
                current = combinedStrips[foundIndex];
                loop.push(...current.strip);
                combinedStrips.splice(foundIndex, 1);
            } else {
                break;
            }
        }
        if (loopStartEdge === current.endEdge) {
            yield loop;
        } else {
            console.error("Unable to join to loop");
        }
    }
}

function projectFace(topology: Topology, worldViewMatrix: ReadonlyMat4) {
    const { vertices } = topology;
    const positionsVS = new Array<vec3>(vertices.length);
    for (let i = 0; i < vertices.length; i++) {
        positionsVS[i] = vec3.create();
        vec3.transformMat4(positionsVS[i], vertices[i].pos, worldViewMatrix);
    }

    const normalsVS = new Array<vec3>(vertices.length);
    const worldViewMatrixNormal = mat3.normalFromMat4(mat3.create(), worldViewMatrix);
    for (let i = 0; i < vertices.length; i++) {
        normalsVS[i] = vec3.create();
        vec3.transformMat3(normalsVS[i], vertices[i].normal, worldViewMatrixNormal);
    }

    const cameraDir = vec3.fromValues(0, 0, 1);
    vec3.transformMat3(cameraDir, cameraDir, worldViewMatrixNormal);
    return { positionsVS, normalsVS };
}

export function getProjectedLoops(face: Face, worldViewMatrix: ReadonlyMat4) {
    const topology = createTopology(face);

    const { normalsVS, positionsVS } = projectFace(topology, worldViewMatrix);
    const loops: ReadonlyVec3[][] = [];

    const { trimLoops, trimStrips } = getTrimStrips(topology, normalsVS);
    loops.push(...trimLoops);

    const { loops: contourLoops, contourStrips } = getContourEdges(topology, normalsVS);
    loops.push(...contourLoops);

    const combinedStrips = [...contourStrips, ...trimStrips];
    loops.push(...loopsFromStrips(combinedStrips));

    //DEBUG CODE
    const { vertices, triangles, edges } = topology;
    const trimEdges = getTrimEdges(topology, normalsVS, 0).map((i) => edges[i].vertices);
    ///

    return { loops, trimLoops, contourLoops, trimEdges, vertices, positionsVS };
}
