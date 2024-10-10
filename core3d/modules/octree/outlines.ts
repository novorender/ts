import { vec3, type ReadonlyMat4, type ReadonlyVec3, type ReadonlyVec4, mat4, vec2, type ReadonlyVec2, vec4, glMatrix } from "gl-matrix";
import type { OctreeModuleContext, RenderNode } from "./context";
import { orthoNormalBasisMatrixFromPlane } from "core3d/util";
import { glCreateBuffer, glCreateVertexArray, glDelete, glDraw, glState } from "webgl2";
import { OctreeNode } from "./node";
import { MaterialType, type Mesh } from "./mesh";
import type { DerivedRenderState, RGB } from "web_app";

type ObjectId = number;
type ChildIndex = number;
type CoordKey = bigint;
type NodeLineClusters = Map<ChildIndex, readonly LineCluster[]>; // key: child_index

export interface LineCluster {
    readonly objectId: number;
    readonly segments: number; // # of line segments
    readonly vertices: Float32Array; // xy positions for line segments in plane space (one pair per triangle/segment)
    readonly normals: Int16Array; // triangle normals (one per triangle/segment)
    readonly points: Uint32Array; // list of vertex indices to hard-edge points into the segment vertices.
    active: boolean;
}

class NodeIntersectionBuilder {
    readonly clusters: LineCluster[] = [];
    readonly posBuffer: Float32Array;
    readonly normalBuffer: Int16Array;
    constructor(maxSegments = 0x4_0000) {
        this.posBuffer = new Float32Array(maxSegments * 4);
        this.normalBuffer = new Int16Array(maxSegments * 3);
    }
}


/*
Just as with object highlights, we can do intersection testing at load time.
This means we already have everything in system memory and no copies are needed.
Also, we can probably save memory (and performance) by clipping against all clipping planes in the process.
We could even do void filling with triangles here by clipping to node boundaries.

For rendering it's probably a good idea to keep a separate VAO per node,
possibly with draw ranges/multidraw, just like normal rendering would.

We can also render the clipping plane in separate 2D space.

For analysis/measurement, we should probably copy from GPU memory on demand (per node) and combine into singular/global lists.
We could also merge line segment soup into strips and loops, merging partial lines and optimizing in the process.

How do we stay within GPU memory budget?
*/

// TODO: Alloc fixed sized render buffer(s) and draw in batches.
// TODO: Reuse previous render buffers if nothing has changed since last frame
// TODO: Ignore transparent meshes/materials
// TODO: Apply alpha from intersection normal
// TODO: Render lines with quads instead.
// TODO: Render edge intersections as circles.
// TODO: Do intersection tests at load time (and store in cache)
// TODO: Render per node (no need to merge into single/big VB).
// TODO: Apply highlighting.
// TODO: Combine all clipping planes in same renderer.
// TODO: Fill in voids with texture/polys.

export class OutlineRenderer {
    static readonly denormMatrix16 = normIntToFloatMatrix(16);
    static readonly denormMatrix32 = normIntToFloatMatrix(32);
    readonly planeLocalMatrix: ReadonlyMat4;
    readonly localPlaneMatrix: ReadonlyMat4;
    readonly nodeLinesCache = new WeakMap<OctreeNode, NodeLineClusters>();
    readonly lineClusters: WeakRef<LineCluster>[] = [];

    constructor(
        readonly context: OctreeModuleContext,
        readonly localSpaceTranslation: ReadonlyVec3,
        readonly plane: ReadonlyVec4,
        readonly edgeAngleThreshold: number,
        readonly minVertexSpacing: number,
        readonly highlightIndices: Uint8Array
    ) {
        const { planeLocalMatrix, localPlaneMatrix } = planeMatrices(plane, localSpaceTranslation);
        this.planeLocalMatrix = planeLocalMatrix;
        this.localPlaneMatrix = localPlaneMatrix;
    }

    resetActiveClusters() {
        for (const cluster of this.getLineClusters()) {
            cluster.active = false;
        }
    }

    *intersectTriangles(renderNodes: readonly RenderNode[]): IterableIterator<LineCluster> {
        this.resetActiveClusters();
        const lineClusterArrays = new Map<number, LineCluster[]>(); // key: object_id
        for (const { mask, node } of renderNodes) {
            if (node.intersectsPlane(this.plane)) {
                const nodeClusters = this.nodeLinesCache.get(node) ?? this.createNodeLineClusters(node);
                // convert clusters into a map by objectId by merging the vertices of actively rendered child indices
                for (const [childIndex, clusters] of nodeClusters) {
                    if (((1 << childIndex) & mask) || (node.isRoot && mask === 0)) {
                        for (const cluster of clusters) {
                            cluster.active = true;
                            let arr = lineClusterArrays.get(cluster.objectId);
                            if (!arr) {
                                arr = [];
                                lineClusterArrays.set(cluster.objectId, arr);
                            }
                            arr.push(cluster);
                        }
                    }
                }
            }
        }
        // flatten vertices into a single array per object_id
        // this should probably be written directly into a GPU vertex buffer.
        let lines = 0;
        for (const [objectId, clusters] of lineClusterArrays) {
            const segments = clusters.map(e => e.segments).reduce((a, b) => (a + b));
            const cluster = {
                objectId,
                segments,
                vertices: flattenF32Arrays(clusters.map(e => e.vertices)),
                normals: flattenI16Arrays(clusters.map(e => e.normals)),
                points: flattenIndices(clusters),
                active: true
            } as const satisfies LineCluster;
            lines += segments;
            yield cluster;
        }
    }

    // create intersection line clusters for node
    createNodeLineClusters(node: OctreeNode) {
        const childBuilders = new Map<ChildIndex, NodeIntersectionBuilder>();
        const { context, localSpaceTranslation, localPlaneMatrix, edgeAngleThreshold, minVertexSpacing } = this;
        const { gl } = context.renderContext;
        const { denormMatrix16, denormMatrix32 } = OutlineRenderer;
        const edgeAngleThresholdCos = Math.cos(glMatrix.toRadian(edgeAngleThreshold));
        const modelLocalMatrix = node.getModelLocalMatrix(localSpaceTranslation);
        const modelPlaneMatrix = mat4.create();
        // modelPlaneMatrix = localPlaneMatrix * modelLocalMatrix * denormMatrix
        const posBPC = node.posBPC ?? 16;

        for (const mesh of node.meshes) {
            if (mesh.numTriangles && mesh.drawParams.mode == "TRIANGLES" && mesh.idxBuf) {
                mat4.mul(modelPlaneMatrix, mat4.mul(modelPlaneMatrix, localPlaneMatrix, modelLocalMatrix), posBPC == 16 ? denormMatrix16 : denormMatrix32);
                const doubleSided = mesh.materialType == MaterialType.opaqueDoubleSided || mesh.materialType == MaterialType.transparent;
                const { drawRanges, objectRanges } = mesh;
                const { idxBuf, posBuf } = getMeshBuffers(gl, mesh, posBPC);
                // transform positions into clipping plane space, i.e. xy on plane, z above or below
                const posPS = new Float32Array(posBuf.length);
                const m = modelPlaneMatrix;

                const posBufLength = posBuf.length;
                for (let i = 0; i < posBufLength; i += 3) {
                    // Hot loop, so inline transformMat4
                    // Tried special case without `w` when it's always=1, but no difference
                    const x = posBuf[i + 0];
                    const y = posBuf[i + 1];
                    const z = posBuf[i + 2];
                    const w = (m[3] * x + m[7] * y + m[11] * z + m[15]) || 1.0;
                    posPS[i + 0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
                    posPS[i + 1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
                    posPS[i + 2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
                }

                // intersect triangles for all draw ranges
                for (const drawRange of drawRanges) {
                    const { childIndex } = drawRange;
                    let childBuilder = childBuilders.get(childIndex);
                    if (!childBuilder) {
                        childBuilder = new NodeIntersectionBuilder();
                        childBuilders.set(childIndex, childBuilder);
                    }
                    const { clusters, posBuffer, normalBuffer } = childBuilder;
                    const beginTriangle = drawRange.first / 3;
                    const endTriangle = beginTriangle + drawRange.count / 3;
                    // extract one object range at a time.
                    for (const objectRange of objectRanges) {
                        if (objectRange.beginTriangle < beginTriangle || objectRange.endTriangle > endTriangle)
                            continue;
                        const { objectId } = objectRange;
                        const begin = objectRange.beginTriangle * 3;
                        const end = objectRange.endTriangle * 3;
                        const idxView = idxBuf.subarray(begin, end);
                        const segments = intersectTriangles(posBuffer, normalBuffer, idxView, posPS);
                        if (segments) {
                            const vertices = posBuffer.slice(0, segments * 4);
                            const normals = normalBuffer.slice(0, segments * 3);
                            const points = extractEdges(segments, vertices, normals, edgeAngleThresholdCos, minVertexSpacing, doubleSided);
                            // TODO: Clip lines against other clipping planes?
                            const lineCluster = { objectId, segments, vertices, normals, points, active: true } as const satisfies LineCluster;
                            clusters.push(lineCluster);
                            this.lineClusters.push(new WeakRef(lineCluster));
                        }
                    }
                }
            }
        }
        const lineClusters = new Map<ChildIndex, readonly LineCluster[]>(
            [...childBuilders.entries()].map(([childIndex, builder]) => ([childIndex, builder.clusters] as const))
        );
        this.nodeLinesCache.set(node, lineClusters);
        return lineClusters;
    }

    makeBuffers(clusters: readonly LineCluster[], state: DerivedRenderState, outlineColor: RGB) {
        if (clusters.length > 0) {
            const { context, highlightIndices } = this;
            const { gl } = context.renderContext;
            const totalSegments = clusters.map(e => e.segments).reduce((a, b) => (a + b));
            const totalPoints = clusters.map(e => e.points.length).reduce((a, b) => (a + b));
            const linePos = new Float32Array(totalSegments * 4);
            const pointPos = new Float32Array(totalPoints * 2);
            const pointsHidden = new Uint32Array(totalPoints);
            const colors = new Uint32Array(totalSegments);
            const objectIds = new Uint32Array(totalSegments);
            // const indices = new Uint32Array(totalIndices);
            let segmentOffset = 0;
            let pointOffset = 0;
            for (const { objectId, segments, points, vertices, normals } of clusters) {
                // add vertex indices for vertex/edge rendering.
                const vtxOffset = segmentOffset * 2;
                const highlightIndex = highlightIndices[objectId];
                const isHiddenOrFiltered = highlightIndex === 254 || highlightIndex === 255;
                for (let i = 0; i < points.length; i++) {
                    const idx = points[i]; // + vtxOffset;
                    pointsHidden[pointOffset / 2] = isHiddenOrFiltered ? 1 : 0;
                    pointPos[pointOffset++] = vertices[idx * 2 + 0];
                    pointPos[pointOffset++] = vertices[idx * 2 + 1];
                }
                // use normal to change alpha in color
                if (isHiddenOrFiltered) {
                    linePos.set(vertices, segmentOffset * 4);
                    for (let i = 0; i < segments; i++) {
                        colors[segmentOffset + i] = 0;
                    }
                } else {
                    const [r, g, b] = (highlightIndex ? state.highlights.groups[highlightIndex - 1].outlineColor : undefined) ?? outlineColor;
                    const baseColor = packRGBA(r / 4, g / 4, b / 4); // allow some overB-exposure at the expense of lower bit resolution
                    linePos.set(vertices, segmentOffset * 4);
                    for (let i = 0; i < segments; i++) {
                        const nz = snorm16ToFloat(normals[i * 3 + 2]);
                        const alpha = 1 - Math.min(1, Math.abs(nz));
                        colors[segmentOffset + i] = baseColor | (alpha * 255 << 24);
                    }
                }

                objectIds.fill(objectId, segmentOffset, segmentOffset + segments);
                segmentOffset += segments;
            }
            console.assert(totalSegments == segmentOffset);
            console.assert(totalPoints * 2 == pointOffset);

            const pointPosBuffer = glCreateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: pointPos, usage: "STREAM_DRAW" });
            const pointHiddenBuffer = glCreateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: pointsHidden, usage: "STREAM_DRAW" });
            const linePosBuffer = glCreateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: linePos, usage: "STREAM_DRAW" });
            const colorBuffer = glCreateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: colors, usage: "STREAM_DRAW" });
            const objectIdBuffer = glCreateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: objectIds, usage: "STREAM_DRAW" });
            const linesVAO = glCreateVertexArray(gl, {
                attributes: [
                    { kind: "FLOAT", componentCount: 4, componentType: "FLOAT", normalized: false, buffer: linePosBuffer, byteOffset: 0, byteStride: 16, divisor: 1 },
                    { kind: "FLOAT", componentCount: 4, componentType: "UNSIGNED_BYTE", normalized: true, buffer: colorBuffer, byteOffset: 0, byteStride: 4, divisor: 1 },
                    { kind: "UNSIGNED_INT", componentCount: 1, componentType: "UNSIGNED_INT", buffer: objectIdBuffer, byteOffset: 0, byteStride: 4, divisor: 1 },
                ],
            });
            const pointsVAO = glCreateVertexArray(gl, {
                attributes: [
                    { kind: "FLOAT", componentCount: 2, componentType: "FLOAT", normalized: false, buffer: pointPosBuffer, byteOffset: 0, byteStride: 8 },
                    { kind: "UNSIGNED_INT", componentCount: 1, componentType: "UNSIGNED_INT", buffer: pointHiddenBuffer, byteOffset: 0, byteStride: 4 },
                ],
            });
            glDelete(gl, [pointPosBuffer, linePosBuffer, colorBuffer, objectIdBuffer, pointHiddenBuffer]); // the VAOs array already references these buffers, so we release our reference on them early.
            return { linesCount: totalSegments, pointsCount: totalPoints, linesVAO, pointsVAO } as const;
        }
    }

    renderLines(count: number, vao: WebGLVertexArrayObject) {
        const { context } = this;
        const { renderContext } = context;
        const { programs } = context.resources;
        const { gl, cameraUniforms, clippingUniforms, outlineUniforms } = renderContext;
        glState(gl, {
            // drawbuffers: both?
            uniformBuffers: [cameraUniforms, clippingUniforms, outlineUniforms, null],
            program: programs.line,
            vertexArrayObject: vao,
            depth: {
                test: false,
                writeMask: false
            },
        });
        const stats = glDraw(gl, { kind: "arrays_instanced", mode: "TRIANGLE_STRIP", count: 4, instanceCount: count });
        renderContext.addRenderStatistics(stats);
    }

    renderPoints(count: number, vao: WebGLVertexArrayObject) {
        const { context } = this;
        const { renderContext } = context;
        const { programs } = context.resources;
        const { gl, cameraUniforms, clippingUniforms, outlineUniforms } = renderContext;
        glState(gl, {
            // drawbuffers: both?
            uniformBuffers: [cameraUniforms, clippingUniforms, outlineUniforms, null],
            program: programs.point,
            vertexArrayObject: vao,
            depth: {
                test: false,
                writeMask: false
            },
        });
        // const stats = glDraw(gl, { kind: "elements", mode: "POINTS", indexType: "UNSIGNED_INT", count });
        const stats = glDraw(gl, { kind: "arrays", mode: "POINTS", count });
        renderContext.addRenderStatistics(stats);
    }

    *getLineClusters(): IterableIterator<LineCluster> {
        const { lineClusters, highlightIndices } = this;
        for (let i = 0; i < lineClusters.length; ++i) {
            const clusterRef = lineClusters[i];
            const cluster = clusterRef.deref();
            if (cluster) {
                if (cluster.active && highlightIndices[cluster.objectId] != 254) {
                    yield cluster;
                }
            } else {
                lineClusters.splice(i--, 1);
            }
        }
    }

    // get edge intersection vertices - in local space
    *getVertices(cluster: LineCluster): IterableIterator<ReadonlyVec3> {
        const { points, vertices } = cluster;
        const { planeLocalMatrix, localSpaceTranslation } = this;
        const p = vec3.create();
        for (const idx of points) {
            p[0] = vertices[idx * 2 + 0];
            p[1] = vertices[idx * 2 + 1];
            p[2] = 0;
            vec3.transformMat4(p, p, planeLocalMatrix);
            vec3.add(p, p, localSpaceTranslation);
            yield p;
        }
    }

    *getLines(cluster: LineCluster): IterableIterator<[ReadonlyVec3, ReadonlyVec3]> {
        const { vertices } = cluster;
        const { planeLocalMatrix } = this;
        for (let i = 0; i < vertices.length; i += 4) {
            const [x1, y1, x2, y2] = vertices.subarray(i, i + 4);
            const start = vec3.fromValues(x1, y1, 0);
            const end = vec3.fromValues(x2, y2, 0);
            vec3.transformMat4(start, start, planeLocalMatrix);
            vec3.transformMat4(end, end, planeLocalMatrix);
            vec3.add(start, start, this.localSpaceTranslation);
            vec3.add(end, end, this.localSpaceTranslation);
            yield [start, end];
        }
    }

    *get2dLines(cluster: LineCluster): IterableIterator<[ReadonlyVec2, ReadonlyVec2]> {
        const { vertices } = cluster;
        for (let i = 0; i < vertices.length; i += 4) {
            const [x1, y1, x2, y2] = vertices.subarray(i, i + 4);
            const start = vec2.fromValues(x1, y1);
            const end = vec2.fromValues(x2, y2);
            yield [start, end];
        }
    }

    transformToPlane(v: ReadonlyVec3): ReadonlyVec2 {
        const { localPlaneMatrix, localSpaceTranslation } = this;
        const p = vec3.sub(vec3.create(), v, localSpaceTranslation);
        vec3.transformMat4(p, p, localPlaneMatrix);
        return vec2.fromValues(p[0], p[1]);
    }

    transformFromPlane(v: ReadonlyVec2): ReadonlyVec3 {
        const { planeLocalMatrix, localSpaceTranslation } = this;
        const p = vec3.fromValues(v[0], v[1], 0);
        vec3.transformMat4(p, p, planeLocalMatrix);
        vec3.add(p, p, localSpaceTranslation);
        return p;
    }
}

function floatToSnorm16(float: number) {
    if (float < -1) float = -1;
    else if (float > 1) float = 1;
    return Math.round(float * 0x7fff);
}

function snorm16ToFloat(snorm16: number) {
    return snorm16 / 0x7fff; // we expect snorm16 to be within [-0x7fff, 0x7fff]
}

function getMeshBuffers(gl: WebGL2RenderingContext, mesh: Mesh, posBPC: 16 | 32) {
    gl.bindVertexArray(null);
    const numIndices = mesh.numTriangles * 3;
    const { numVertices } = mesh;
    // get index buffer
    const IdxType = numVertices > 0xffff ? Uint32Array : Uint16Array;
    const idxBuf = new IdxType(numIndices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
    gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, idxBuf, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    // get position buffer
    const arrayType = posBPC == 16 ? Int16Array : Int32Array;
    const posBuf = new arrayType(numVertices * 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posVB);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, posBuf, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { idxBuf, posBuf } as const;
}

function normIntToFloatMatrix(bits: number) {
    // Positions in model (node) space are given in 32 bit signed normalized ints.
    // Prior to opengl 4.2, this means mapping [-0x8000, 0x7fff] to [-1, 1] respectively: https://www.khronos.org/opengl/wiki/Normalized_Integer
    // This roughly equates to f = (v + 0.5) / 32767.5
    const s = 1 / (Math.pow(2, bits - 1) - 0.5);
    const o = 0.5 * s;
    return mat4.fromValues(
        s, 0, 0, 0,
        0, s, 0, 0,
        0, 0, s, 0,
        o, o, o, 1,
    );
}

function flattenF32Arrays(items: readonly Float32Array[]): Float32Array {
    const size = items.map(item => item.length).reduce((a, b) => (a + b));
    const output = new Float32Array(size);
    let offset = 0;
    for (const item of items) {
        output.set(item, offset);
        offset += item.length;
    }
    return output;
}

function flattenI16Arrays(items: readonly Int16Array[]): Int16Array {
    const size = items.map(item => item.length).reduce((a, b) => (a + b));
    const output = new Int16Array(size);
    let offset = 0;
    for (const item of items) {
        output.set(item, offset);
        offset += item.length;
    }
    return output;
}

function flattenIndices(clusters: readonly LineCluster[]): Uint32Array {
    const size = clusters.map(e => e.points.length).reduce((a, b) => (a + b));
    const output = new Uint32Array(size);
    let i = 0;
    let o = 0;
    for (const { vertices, points } of clusters) {
        for (const idx of points) {
            output[i++] = idx + o;
        }
        o += vertices.length / 2;
    }
    console.assert(i == size);
    return output;
}

function planeMatrices(plane: ReadonlyVec4, localSpaceTranslation: ReadonlyVec3) {
    const [x, y, z, o] = plane;
    const normal = vec3.fromValues(x, y, z);
    const distance = -o - vec3.dot(localSpaceTranslation, normal);
    const planeLS = vec4.fromValues(normal[0], normal[1], normal[2], -distance);
    const planeLocalMatrix = orthoNormalBasisMatrixFromPlane(planeLS);
    const localPlaneMatrix = mat4.invert(mat4.create(), planeLocalMatrix);
    return { planeLocalMatrix, localPlaneMatrix } as const;
}

/**
 * Intersect triangles against specificed plane
 * @param segmentPos Output line vertex pair (xy coord) buffer as f32.
 * @param segmentNormal Output line triangle normal (in plane space) as snorm16.
 * @param idx Vertex index triplets (triangles)
 * @param pos Vertex positions in model (node) space, as snorm16
 * @param modelToPlaneMatrix Matrix to transform from snorm16 model space into plane space
 */
function intersectTriangles(segmentPos: Float32Array, segmentNormal: Int16Array, idx: Uint16Array | Uint32Array, pos: Float32Array) {
    const p0 = vec3.create(); const p1 = vec3.create(); const p2 = vec3.create();
    let n = 0;
    function emit(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, nz: number) {
        segmentPos[n * 4 + 0] = x0;
        segmentPos[n * 4 + 1] = y0;
        segmentPos[n * 4 + 2] = x1;
        segmentPos[n * 4 + 3] = y1;
        // We don't need a lot of precision of normals for vertex classification, so we go for snorm16.
        segmentNormal[n * 3 + 0] = floatToSnorm16(nx);
        segmentNormal[n * 3 + 1] = floatToSnorm16(ny);
        segmentNormal[n * 3 + 2] = floatToSnorm16(nz);
        n++;
    }

    // for each triangle...
    console.assert(idx.length % 3 == 0); // assert that we are dealing with triangles.
    const ab = vec3.create(); const ac = vec3.create(); const normal = vec3.create();
    for (let i = 0; i < idx.length; i += 3) {
        const i0 = idx[i + 0]; const i1 = idx[i + 1]; const i2 = idx[i + 2];
        if (i0 == i1 || i0 == i2 || i1 == i2)
            continue; // skip degenerate triangles
        // check if z-coords are greater and less than 0
        const z0 = pos[i0 * 3 + 2]; const z1 = pos[i1 * 3 + 2]; const z2 = pos[i2 * 3 + 2];
        const gt0 = z0 > 0; const gt1 = z1 > 0; const gt2 = z2 > 0;
        const lt0 = z0 < 0; const lt1 = z1 < 0; const lt2 = z2 < 0;
        // does triangle intersect plane?
        // this test is not just a possible optimization, but also excludes problematic triangles that straddles the plane along an edge or vertex only
        if ((gt0 || gt1 || gt2) && (lt0 || lt1 || lt2)) { // SIMD: any()?
            // compute triangle normal
            vec3.set(p0, pos[i0 * 3 + 0], pos[i0 * 3 + 1], z0);
            vec3.set(p1, pos[i1 * 3 + 0], pos[i1 * 3 + 1], z1);
            vec3.set(p2, pos[i2 * 3 + 0], pos[i2 * 3 + 1], z2);
            vec3.sub(ab, p1, p0);
            vec3.sub(ac, p2, p0);
            vec3.cross(normal, ab, ac);
            const [nx, ny, nz] = vec3.normalize(normal, normal);
            const l2 = nx * nx + ny * ny + nz * nz;
            if (l2 < 0.9 || l2 > 1.1)
                continue; // skip degenerate triangles.

            // check for half-edge intersections in negative direction
            const v0 = intersectHalfEdge(p1, p0) ?? intersectHalfEdge(p2, p1) ?? intersectHalfEdge(p0, p2)!;
            // check for half-edge intersections in positive direction
            const v1 = intersectHalfEdge(p0, p1) ?? intersectHalfEdge(p1, p2) ?? intersectHalfEdge(p2, p0)!;
            emit(v0[0], v0[1], v1[0], v1[1], nx, ny, nz);

            // // check for edge intersections
            // intersectEdge(emit, p0, p1);
            // intersectEdge(emit, p1, p2);
            // intersectEdge(emit, p2, p0);
            // console.assert(n % 2 == 0); // check that there are always pairs of vertices
        }
    }
    return n;
}

function intersectHalfEdge(v0: ReadonlyVec3, v1: ReadonlyVec3): ReadonlyVec2 | undefined {
    const [x0, y0, z0] = v0;
    const [x1, y1, z1] = v1;
    if (z0 <= 0 && z1 > 0) {
        const t = -z0 / (z1 - z0);
        return vec2.fromValues(
            lerp(x0, x1, t),
            lerp(y0, y1, t),
        );
    }
}

function intersectEdge(emit: (x: number, y: number) => void, v0: ReadonlyVec3, v1: ReadonlyVec3) {
    const [x0, y0, z0] = v0;
    const [x1, y1, z1] = v1;
    if ((z0 <= 0 && z1 > 0) || (z1 <= 0 && z0 > 0)) {
        const t = -z0 / (z1 - z0);
        emit(
            lerp(x0, x1, t),
            lerp(y0, y1, t),
        );
    }
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
}

// The key is 64 bits, where x and y coords are 16:16 bits fixed point numbers.
// This gives us ~15μm precision and a max distance of ~32km in local space (essentially relative to camera).
function keyFromXY(x: number, y: number): CoordKey {
    const xi = clamp(Math.round((x + 0x8000) * 0x1_0000), 0, 0xffff_ffff);
    const yi = clamp(Math.round((y + 0x8000) * 0x1_0000), 0, 0xffff_ffff);
    return BigInt(xi) | BigInt(yi) << 32n;
}

function xyFromKey(key: CoordKey): readonly [x: number, y: number] {
    return [Number(key & 0xffff_ffffn) / 0x1_0000 - 0x8000, Number((key >> 32n) & 0xffff_ffffn) / 0x1_0000 - 0x8000];
}

function packRGBA(r: number, g: number, b: number, a = 1) {
    return (
        clamp(r, 0, 1) * 255 << 0 |
        clamp(g, 0, 1) * 255 << 8 |
        clamp(b, 0, 1) * 255 << 16 |
        clamp(a, 0, 1) * 255 << 24
    );
}

// TODO: add varying ways to project/compute 2D thickness
function extractEdges(segments: number, vertices: Float32Array, normals: Int16Array, edgeAngleThresholdCos: number, minVertexSpacing: number, doubleSided: boolean) {
    const xyVertexMap = new Map<CoordKey, number>();
    const xySegmentMap = new Map<CoordKey, number[]>();
    function keyFromVertex(vertexIndex: number): CoordKey {
        return keyFromXY(vertices[vertexIndex * 2 + 0], vertices[vertexIndex * 2 + 1]);
    }
    function getSegmentLengthSqr(segmentIndex: number) {
        const x0 = vertices[segmentIndex * 4 + 0];
        const y0 = vertices[segmentIndex * 4 + 1];
        const x1 = vertices[segmentIndex * 4 + 2];
        const y1 = vertices[segmentIndex * 4 + 3];
        const dx = x1 - x0;
        const dy = y1 - y0;
        return dx * dx + dy * dy;
    }
    function addSegmentVertex(segmentIndex: number, vertexIndex: number) {
        const key = keyFromVertex(vertexIndex);
        xyVertexMap.set(key, vertexIndex);
        let ar = xySegmentMap.get(key);
        if (!ar) {
            ar = [];
            xySegmentMap.set(key, ar);
        }
        ar.push(segmentIndex);
    }
    function getNormal(i: number) {
        return vec3.fromValues(
            snorm16ToFloat(normals[i * 3 + 0]),
            snorm16ToFloat(normals[i * 3 + 1]),
            snorm16ToFloat(normals[i * 3 + 2]),
        );
    }
    // map unique xy coordinates to neighboring segments
    for (let i = 0; i < segments; i++) {
        addSegmentVertex(i, i * 2 + 0);
        addSegmentVertex(i, i * 2 + 1);
    }
    // determine the edge angle of each unique xy coordinate
    const t2 = minVertexSpacing * minVertexSpacing;
    const vertexIndices: number[] = [];
    for (const [key, segmentIndices] of xySegmentMap) {
        // we only care about manifold edges.
        if (segmentIndices.length > 1) {
            // get the neighboring triangle normals.
            const triNorms = segmentIndices.map(i => getNormal(i));
            const segLengths = segmentIndices.map(i => getSegmentLengthSqr(i));
            let minAngleCos = 2;
            const n = segmentIndices.length;
            // There might be more than 2 connected triangles (albeit rare), so we pick the largest angle (smallest cos) between all possible combinations.
            for (let i = 0; i < n - 1; i++) {
                for (let j = i + 1; j < n; j++) {
                    let angleCos = vec3.dot(triNorms[i], triNorms[j]);
                    if (doubleSided) {
                        // check direction of both neighbor triangle segments, i.e. is it the first or second segment vertex/edge that is shared.
                        const dir0 = keyFromVertex(segmentIndices[i] * 2) == key;
                        const dir1 = keyFromVertex(segmentIndices[j] * 2) == key;
                        if (dir0 == dir1) {
                            // the triangles do not have the same winding, so we must negate the cos value to account for this.
                            minAngleCos = -minAngleCos;
                        }
                    }
                    if (minAngleCos > angleCos && (segLengths[i] > t2 || segLengths[j] > t2)) {
                        minAngleCos = angleCos;
                    }
                }
            }
            if (minAngleCos <= edgeAngleThresholdCos) {
                const vertexIndex = xyVertexMap.get(key)!;
                console.assert(vertexIndex != undefined);
                vertexIndices.push(vertexIndex);
            }
        }
        else if (doubleSided && segmentIndices.length == 1 && getSegmentLengthSqr(segmentIndices[0]) > t2) {
            const vertexIndex = xyVertexMap.get(key)!;
            console.assert(vertexIndex != undefined);
            vertexIndices.push(vertexIndex);
        }
    }
    return new Uint32Array(vertexIndices);
}
