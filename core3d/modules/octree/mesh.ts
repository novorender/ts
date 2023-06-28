import { glUpdateBuffer, type DrawParams, type VertexAttribute, type DrawParamsArraysMultiDraw, type DrawParamsElementsMultiDraw } from "webgl2";
import type { MeshDrawRange, MeshObjectRange, NodeGeometry, VertexAttributeData } from "./parser";
import { MaterialType } from "./schema";
import { ResourceBin } from "core3d/resource";

export interface Mesh {
    readonly materialType: MaterialType;
    readonly vao: WebGLVertexArrayObject;
    readonly vaoPosOnly: WebGLVertexArrayObject | null;
    readonly vaoTriangles: WebGLVertexArrayObject | null;
    readonly highlightVB: WebGLBuffer | null;
    readonly numVertices: number;
    readonly numTriangles: number;
    readonly drawParams: DrawParams;
    readonly drawRanges: readonly MeshDrawRange[];
    readonly objectRanges: readonly MeshObjectRange[];
    readonly baseColorTexture: WebGLTexture | null;
}

export function* createMeshes(resourceBin: ResourceBin, geometry: NodeGeometry) {
    const textures = geometry.textures.map(ti => {
        if (ti) {
            return resourceBin.createTexture(ti.params);
        }
    });

    for (const subMesh of geometry.subMeshes) {
        // if (subMesh.materialType == MaterialType.transparent)
        //     continue;
        const { vertexAttributes, vertexBuffers, indices, numVertices, numTriangles, drawRanges, objectRanges, materialType } = subMesh;
        const buffers = vertexBuffers.map(vb => {
            return resourceBin.createBuffer({ kind: "ARRAY_BUFFER", srcData: vb });
        })
        const ib = typeof indices != "number" ? resourceBin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: indices }) : undefined;
        const count = typeof indices == "number" ? indices : indices.length;
        const indexType = indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT";
        const { triangles, position, normal, material, objectId, texCoord, color, projectedPos, deviations } = vertexAttributes;
        function convertAttrib(a: VertexAttributeData | null) {
            return a ? { ...a, buffer: buffers[a.buffer] } as VertexAttribute : null;
        }
        const attributes = [position, normal, material, objectId, texCoord, color, projectedPos, deviations].map(convertAttrib);
        const triangleAttributes = triangles ? triangles.map(convertAttrib) : null;

        // add extra highlight vertex buffer and attribute
        const highlightVB = resourceBin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: subMesh.numVertices });
        attributes.push({ kind: "UNSIGNED_INT", buffer: highlightVB, componentType: "UNSIGNED_BYTE" });

        const vao = resourceBin.createVertexArray({ attributes, indices: ib });
        const vaoPosOnly = position.buffer != 0 ? resourceBin.createVertexArray({ attributes: [attributes[0]], indices: ib }) : null;
        const vaoTriangles = triangleAttributes ? resourceBin.createVertexArray({ attributes: triangleAttributes }) : null;
        resourceBin.subordinate(vao, ...buffers);
        if (ib) {
            resourceBin.subordinate(vao, ib);
        }

        const drawParams: DrawParams = ib ?
            { kind: "elements", mode: subMesh.primitiveType, indexType, count } :
            { kind: "arrays", mode: subMesh.primitiveType, count };
        const baseColorTextureIndex = subMesh.baseColorTexture as number;
        const baseColorTexture = textures[baseColorTextureIndex] ?? null;
        yield { vao, vaoPosOnly, vaoTriangles, highlightVB, drawParams, drawRanges, numVertices, numTriangles, objectRanges, materialType, baseColorTexture } as const satisfies Mesh;
    }
}

export function updateMeshHighlights(gl: WebGL2RenderingContext, mesh: Mesh, highlights: Uint8Array | undefined) {
    if (mesh.highlightVB) {
        const highlightBuffer = new Uint8Array(mesh.numVertices);
        if (highlights) {
            for (const { objectId, beginVertex, endVertex } of mesh.objectRanges) {
                const highlight = highlights[objectId];
                if (highlight) {
                    highlightBuffer.fill(highlight, beginVertex, endVertex);
                }
            }
        }
        glUpdateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: highlightBuffer, targetBuffer: mesh.highlightVB });
    }
}

export function deleteMesh(resourceBin: ResourceBin, mesh: Mesh) {
    const { vao, vaoPosOnly, vaoTriangles, highlightVB, baseColorTexture } = mesh;
    resourceBin.delete(vao, vaoPosOnly, vaoTriangles, highlightVB, baseColorTexture);
}

export function getMultiDrawParams(mesh: Mesh, childMask: number): DrawParamsArraysMultiDraw | DrawParamsElementsMultiDraw | undefined {
    // determine which draw ranges this parent node must render based on what children will render their own mesh
    const drawRanges = mesh.drawRanges.filter(r => ((1 << r.childIndex) & childMask) != 0);
    if (drawRanges.length == 0) {
        return;
    }
    const offsetsList = new Int32Array(drawRanges.map(r => r.byteOffset));
    const countsList = new Int32Array(drawRanges.map(r => r.count));
    const drawCount = offsetsList.length;
    const { drawParams } = mesh;
    const { mode } = drawParams;
    function isElements(params: DrawParams): params is DrawParamsElementsMultiDraw {
        return "indexType" in params;
    }
    if (isElements(drawParams)) {
        const { indexType } = drawParams;
        return {
            kind: "elements_multidraw",
            mode,
            drawCount,
            indexType,
            byteOffsets: offsetsList,
            counts: countsList
        };
    } else {
        return {
            kind: "arrays_multidraw",
            mode,
            drawCount,
            firstsList: offsetsList,
            counts: countsList
        };
    }
}

export function meshPrimitiveCount(mesh: Mesh, renderedChildMask: number) {
    let numPrimitives = 0;
    const primitiveType = mesh.drawParams.mode ?? "TRIANGLES";
    for (const drawRange of mesh.drawRanges) {
        const childMask = 1 << drawRange.childIndex;
        if ((renderedChildMask & childMask) != 0) {
            numPrimitives += calcNumPrimitives(drawRange.count, primitiveType);
        }
    }
    return numPrimitives;
}

function calcNumPrimitives(vertexCount: number, primitiveType: string) {
    let primitiveCount = 0;
    switch (primitiveType) {
        case "TRIANGLES":
            primitiveCount = vertexCount / 3;
            break;
        case "TRIANGLE_STRIP":
        case "TRIANGLE_FAN":
            primitiveCount = vertexCount - 2; break;
        case "LINES":
            primitiveCount = vertexCount / 2; break;
        case "LINE_STRIP":
            primitiveCount = vertexCount - 1; break;
        default:
            primitiveCount = vertexCount;
    }
    return primitiveCount;
}
