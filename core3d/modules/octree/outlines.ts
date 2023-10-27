import { vec3, type ReadonlyMat4, type ReadonlyVec3, type ReadonlyVec4, mat4, vec2, type ReadonlyVec2, vec4 } from "gl-matrix";
import type { OctreeModuleContext, RenderNode } from "./context";
import { orthoNormalBasisMatrixFromPlane } from "core3d/util";
import { glCreateBuffer, glCreateVertexArray, glDelete, glDraw, glState } from "webgl2";
import { OctreeNode } from "./node";
import type { Mesh } from "./mesh";

type NodeLineClusters = Map<number, readonly LineCluster[]>; // key: child_index

// type LineVertices = readonly ReadonlyVec2[]; // use Float32Array instead?;
type LineVertices = Float32Array;
type ChildIndex = number;
type ObjectIndex = number;

export interface LineCluster {
    readonly objectId: number;
    readonly vertices: LineVertices;
}

interface ChildRange {
    readonly childIndex: number;
    readonly begin: number;
    readonly end: number;
}


class NodeIntersection {
    constructor(
        // readonly pointsVAO: WebGLVertexArrayObject, // edge intersections
        readonly lineRanges: readonly ChildRange[],
        readonly linesVAO: WebGLVertexArrayObject, // triangle intersections
        // TODO: Add triangles VAO for void filling
    ) { }

    render(mask: number) {
        // we need render context (and possibly render state) here...
    }
}

class NodeIntersectionBuilder {
    static readonly maxBufferSize = 0x100000;
    readonly clusters: LineCluster[] = [];
    readonly buffer = new Float32Array(NodeIntersectionBuilder.maxBufferSize);
    offset = 0;
    // get outputBuffer() { return this.buffer.subarray(this.offset); }
    emitVertex(x: number, y: number): void {
        this.buffer[this.offset++] = x;
        this.buffer[this.offset++] = y;
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
    static readonly denormMatrix = normInt16ToFloatMatrix();
    readonly planeLocalMatrix: ReadonlyMat4;
    readonly localPlaneMatrix: ReadonlyMat4;
    readonly nodeLinesCache = new WeakMap<OctreeNode, NodeLineClusters>();
    readonly nodeIntersectionCache = new WeakMap<OctreeNode, NodeIntersection>();

    constructor(
        readonly context: OctreeModuleContext,
        readonly localSpaceTranslation: ReadonlyVec3,
        readonly plane: ReadonlyVec4,
    ) {
        const { planeLocalMatrix, localPlaneMatrix } = planeMatrices(plane, localSpaceTranslation);
        this.planeLocalMatrix = planeLocalMatrix;
        this.localPlaneMatrix = localPlaneMatrix;
    }

    *intersectTriangles(renderNodes: readonly RenderNode[]): IterableIterator<LineCluster> {
        const lineClusterArrays = new Map<number, LineVertices[]>(); // key: object_id
        for (const { mask, node } of renderNodes) {
            if (node.intersectsPlane(this.plane)) {
                const nodeClusters = this.nodeLinesCache.get(node) ?? this.createNodeLineClusters(node);
                // convert clusters into a map by objectId by merging the vertices of actively rendered child indices
                for (const [childIndex, clusters] of nodeClusters) {
                    if ((1 << childIndex) & mask) {
                        for (const { objectId, vertices } of clusters) {
                            let arr = lineClusterArrays.get(objectId);
                            if (!arr) {
                                arr = [];
                                lineClusterArrays.set(objectId, arr);
                            }
                            arr.push(vertices);
                        }
                    }
                }
            }
        }
        // flatten vertices into a single array per object_id
        // this should probably be converted into a float32array instead, or possibly directly into GPU vertex buffer.
        // let lineClusterMap = new Map<number, LineCluster>();
        let lines = 0;
        for (const [objectId, arr] of lineClusterArrays) {
            const cluster = { objectId, vertices: flattenF32Arrays(arr) } as const satisfies LineCluster;
            lines += cluster.vertices.length;
            yield cluster;
        }
    }

    // create intersection line clusters for node
    createNodeLineClusters(node: OctreeNode) {
        const childBuilders = new Map<ChildIndex, NodeIntersectionBuilder>();
        const { context, localSpaceTranslation, localPlaneMatrix } = this;
        const { gl } = context.renderContext;
        const { denormMatrix } = OutlineRenderer;
        const modelLocalMatrix = node.getModelLocalMatrix(localSpaceTranslation);
        const modelPlaneMatrix = mat4.create();
        // modelPlaneMatrix = localPlaneMatrix * modelLocalMatrix * denormMatrix
        mat4.mul(modelPlaneMatrix, mat4.mul(modelPlaneMatrix, localPlaneMatrix, modelLocalMatrix), denormMatrix);
        for (const mesh of node.meshes) {
            if (mesh.numTriangles && mesh.drawParams.mode == "TRIANGLES" && !mesh.baseColorTexture && mesh.idxBuf) {
                const { drawRanges, objectRanges } = mesh;
                const { idxBuf, posBuf } = getMeshBuffers(gl, mesh);
                // intersect triangles for all draw ranges
                for (const drawRange of drawRanges) {
                    const { childIndex } = drawRange;

                    let childBuilder = childBuilders.get(childIndex);
                    if (!childBuilder) {
                        childBuilder = new NodeIntersectionBuilder();
                        childBuilders.set(childIndex, childBuilder);
                    }
                    const { clusters, buffer } = childBuilder;

                    const beginTriangle = drawRange.first / 3;
                    const endTriangle = beginTriangle + drawRange.count / 3;
                    // extract one object range at a time.
                    for (const objectRange of objectRanges) {
                        if (objectRange.beginTriangle < beginTriangle || objectRange.endTriangle > endTriangle)
                            continue;
                        const { objectId } = objectRange;
                        const begin = objectRange.beginTriangle * 3;
                        const end = objectRange.endTriangle * 3;
                        // const numTris = end - begin;
                        const idxView = idxBuf.subarray(begin, end);
                        const beginOffset = childBuilder.offset;
                        const lines = intersectTriangles(buffer, childBuilder.offset, idxView, posBuf, modelPlaneMatrix);
                        if (lines) {
                            childBuilder.offset += lines * 4;
                            const endOffset = childBuilder.offset;
                            const vertices = buffer.slice(beginOffset, endOffset);
                            // TODO: Clip lines against other clipping planes?
                            const lineCluster = { objectId, vertices } as const satisfies LineCluster;
                            clusters.push(lineCluster);
                        }
                    }
                }
            }
        }
        // const linesVAO = new Map<ChildIndex, NodeIntersection>();
        // this.makeVAO([{ objectId: 0xffff_ffff, vertices: lineVertBuf.subarray(0, lineVertBufOffset) }])
        // const nodeIntersection = new NodeIntersection(linesVAO);
        // this.nodeIntersectionCache.set(node, nodeIntersection);
        const lineClusters = new Map<ChildIndex, readonly LineCluster[]>(
            [...childBuilders.entries()].map(([childIndex, builder]) => ([childIndex, builder.clusters] as const))
        );
        this.nodeLinesCache.set(node, lineClusters);
        return lineClusters;
    }

    makeVAO(lineClusters: readonly LineCluster[]) {
        let count = 0;
        let vao: WebGLVertexArrayObject | null = null;
        if (lineClusters.length > 0) {
            const { context } = this;
            const { gl } = context.renderContext;
            let numVertices = 0;
            for (const { vertices } of lineClusters) {
                numVertices += vertices.length;
            }
            const byteStride = 6 * 4;
            const vb = new ArrayBuffer((numVertices / 2) * byteStride);
            const f32 = new Float32Array(vb);
            const u32 = new Uint32Array(vb);
            let i = 0;
            for (const { vertices } of lineClusters) {
                for (let j = 0; j < vertices.length; j += 2) {
                    f32[i++] = vertices[j + 0];
                    f32[i++] = vertices[j + 1];
                    if (j % 4 == 2) {
                        count++;
                        u32[i++] = 0xff00_00ff; // color
                        u32[i++] = 0xffff_ffff; // object id
                    }
                }
            }
            const buffer = glCreateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: vb, usage: "STREAM_DRAW" });
            vao = glCreateVertexArray(gl, {
                attributes: [
                    { kind: "FLOAT", componentCount: 4, componentType: "FLOAT", normalized: false, buffer, byteOffset: 0, byteStride, divisor: 1 },
                    { kind: "FLOAT", componentCount: 4, componentType: "UNSIGNED_BYTE", normalized: true, buffer, byteOffset: 16, byteStride, divisor: 1 },
                    { kind: "UNSIGNED_INT", componentCount: 1, componentType: "UNSIGNED_INT", buffer, byteOffset: 20, byteStride, divisor: 1 },
                ],
            });
            glDelete(gl, buffer);
        }
        return {
            count,
            vao,
        } as const;
    }

    render(renderNodes: readonly RenderNode[]) {

    }

    renderLines(count: number, vao: WebGLVertexArrayObject | null) {
        if (!vao)
            return;
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
        const stats = glDraw(gl, { kind: "arrays_instanced", mode: "LINES", count: 2, instanceCount: count });
        renderContext.addRenderStatistics(stats);
    }
}

function getMeshBuffers(gl: WebGL2RenderingContext, mesh: Mesh) {
    gl.bindVertexArray(null);
    const numIndices = mesh.numTriangles * 3;
    const { numVertices } = mesh;
    // get index buffer
    const IdxType = numVertices > 0xffff ? Uint32Array : Uint16Array;
    const idxBuf = new IdxType(numIndices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
    gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, idxBuf, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    const posBuf = new Int16Array(numVertices * 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posVB);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, posBuf, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { idxBuf, posBuf } as const;
}

function normInt16ToFloatMatrix() {
    // Positions in model (node) space are given in 16 bit signed normalized ints.
    // Prior to opengl 4.2, this means mapping [-0x8000, 0x7fff] to [-1, 1] respectively: https://www.khronos.org/opengl/wiki/Normalized_Integer
    // This roughly equates to f = (v + 0.5) / 32767.5
    const s = 1 / 32767.5;
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
 * @param output Output line vertex (xy coord) buffer.
 * @param offset Start index to write in vertex output buffer.
 * @param idx Vertex index triplets (triangles)
 * @param pos Vertex positions in model (node) space, as snorm16
 * @param modelToPlaneMatrix Matrix to transform from snorm16 model space into plane space
 */
function intersectTriangles(output: Float32Array, offset: number, idx: Uint16Array | Uint32Array, pos: Int16Array, modelToPlaneMatrix: ReadonlyMat4) {
    const p0 = vec3.create(); const p1 = vec3.create(); const p2 = vec3.create();
    let n = 0;
    function emit(x: number, y: number) {
        output[offset++] = x;
        output[offset++] = y;
        n++;
    }

    // for each triangle...
    console.assert(idx.length % 3 == 0); // assert that we are dealing with triangles.
    for (let i = 0; i < idx.length; i += 3) {
        const i0 = idx[i + 0]; const i1 = idx[i + 1]; const i2 = idx[i + 2];
        vec3.set(p0, pos[i0 * 3 + 0], pos[i0 * 3 + 1], pos[i0 * 3 + 2]);
        vec3.set(p1, pos[i1 * 3 + 0], pos[i1 * 3 + 1], pos[i1 * 3 + 2]);
        vec3.set(p2, pos[i2 * 3 + 0], pos[i2 * 3 + 1], pos[i2 * 3 + 2]);
        // transform positions into clipping plane space, i.e. xy on plane, z above or below
        vec3.transformMat4(p0, p0, modelToPlaneMatrix);
        vec3.transformMat4(p1, p1, modelToPlaneMatrix);
        vec3.transformMat4(p2, p2, modelToPlaneMatrix);
        // check if z-coords are greater and less than 0
        const z0 = p0[2]; const z1 = p1[2]; const z2 = p2[2];
        const gt0 = z0 > 0; const gt1 = z1 > 0; const gt2 = z2 > 0;
        const lt0 = z0 < 0; const lt1 = z1 < 0; const lt2 = z2 < 0;
        // does triangle intersect plane?
        // this test is not just a possible optimization, but also excludes problematic triangles that straddles the plane along an edge
        if ((gt0 || gt1 || gt2) && (lt0 || lt1 || lt2)) { // SIMD: any()?
            // check for edge intersections
            intersectEdge(emit, p0, p1);
            intersectEdge(emit, p1, p2);
            intersectEdge(emit, p2, p0);
            console.assert(n % 2 == 0); // check that there are always pairs of vertices
        }
    }
    return n / 2;
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
