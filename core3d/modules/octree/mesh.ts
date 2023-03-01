import { glUpdateBuffer, type DrawParams, type VertexAttribute, type DrawParamsArraysMultiDraw, type DrawParamsElementsMultiDraw } from "@novorender/webgl2";
import type { RenderStateHighlightGroup } from "@novorender/core3d";
import { mergeSorted } from "@novorender/core3d/iterate";
import type { MeshDrawRange, MeshObjectRange, NodeGeometry, VertexAttributeData } from "./parser";
import { MaterialType } from "./schema";
import { ResourceBin } from "@novorender/core3d/resource";

export interface Mesh {
    readonly materialType: MaterialType;
    readonly vao: WebGLVertexArrayObject;
    readonly vaoPosOnly: WebGLVertexArrayObject | null;
    readonly vaoTriplets: WebGLVertexArrayObject | null;
    readonly highlightVB: WebGLBuffer | null;
    readonly numVertices: number;
    readonly numTriplets: number;
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
        const { vertexAttributes, vertexBuffers, indices, numVertices, numTriplets, drawRanges, objectRanges, materialType } = subMesh;
        const buffers = vertexBuffers.map(vb => {
            return resourceBin.createBuffer({ kind: "ARRAY_BUFFER", srcData: vb });
        })
        const ib = typeof indices != "number" ? resourceBin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: indices }) : undefined;
        const count = typeof indices == "number" ? indices : indices.length;
        const indexType = indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT";
        const { triplets, position, normal, material, objectId, texCoord, color, deviation } = vertexAttributes;
        function convertAttrib(a: VertexAttributeData | null) {
            return a ? { ...a, buffer: buffers[a.buffer] } as VertexAttribute : null;
        }
        const attributes = [position, normal, material, objectId, texCoord, color, deviation].map(convertAttrib);
        const tripletAttributes = triplets ? triplets.map(convertAttrib) : null;

        // add extra highlight vertex buffer and attribute
        const highlightVB = resourceBin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: subMesh.numVertices });
        attributes.push({ kind: "UNSIGNED_INT", buffer: highlightVB, componentType: "UNSIGNED_BYTE" });

        const vao = resourceBin.createVertexArray({ attributes, indices: ib });
        const vaoPosOnly = position.buffer != 0 ? resourceBin.createVertexArray({ attributes: [attributes[0]], indices: ib }) : null;
        const vaoTriplets = tripletAttributes ? resourceBin.createVertexArray({ attributes: tripletAttributes }) : null;
        resourceBin.subordinate(vao, ...buffers);
        if (ib) {
            resourceBin.subordinate(vao, ib);
        }

        const drawParams: DrawParams = ib ?
            { kind: "elements", mode: subMesh.primitiveType, indexType, count } :
            { kind: "arrays", mode: subMesh.primitiveType, count };
        const baseColorTextureIndex = subMesh.baseColorTexture as number;
        const baseColorTexture = textures[baseColorTextureIndex] ?? null;
        yield { vao, vaoPosOnly, vaoTriplets, highlightVB, drawParams, drawRanges, numVertices, numTriplets, objectRanges, materialType, baseColorTexture } as const satisfies Mesh;
    }
}

// this functon returns all the objectIDs from highlight groups in ascending order, along with their respective highlight index.
// brute force iteration is slower than using maps or lookup arrays, but requires less memory.
function traverseObjectIds(groups: readonly RenderStateHighlightGroup[]) {
    const iterators = groups.map(g => g.objectIds[Symbol.iterator]());
    return mergeSorted(iterators);
}

// this is a potentially slow, but memory efficient way to update highlight vertex attributes
export function updateMeshHighlightGroups(gl: WebGL2RenderingContext, mesh: Mesh, groups: readonly RenderStateHighlightGroup[]) {
    if (mesh.highlightVB) {
        const highlightBuffer = new Uint8Array(mesh.numVertices);
        const iterator = mesh.objectRanges[Symbol.iterator]();
        let currentRange = iterator.next().value as MeshObjectRange | undefined;
        for (const { value, sourceIndex } of traverseObjectIds(groups)) {
            while (currentRange && currentRange.objectId < value) {
                currentRange = iterator.next().value as MeshObjectRange | undefined;
            }
            if (!currentRange) {
                break;
            }
            if (currentRange.objectId == value) {
                const { beginVertex, endVertex } = currentRange;
                highlightBuffer.fill(sourceIndex + 1, beginVertex, endVertex);
            }
        }
        glUpdateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: highlightBuffer, targetBuffer: mesh.highlightVB });
    }
}

export function deleteMesh(resourceBin: ResourceBin, mesh: Mesh) {
    const { vao, vaoPosOnly, vaoTriplets, highlightVB, baseColorTexture } = mesh;
    resourceBin.delete(vao, vaoPosOnly, vaoTriplets, highlightVB, baseColorTexture);
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
