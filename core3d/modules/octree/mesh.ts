import { glUpdateBuffer, type DrawParams, type VertexAttribute, type DrawParamsArraysMultiDraw, type DrawParamsElementsMultiDraw } from "webgl2";
import { type MeshDrawRange, type MeshObjectRange, type NodeGeometry, type VertexAttributeData, type VertexAttributes } from "./worker";
import { ResourceBin } from "core3d/resource";

export const enum MaterialType {
    opaque = 0,
    opaqueDoubleSided = 1,
    transparent = 2,
    elevation = 3,
};


/** @internal */
export interface Mesh {
    readonly materialType: MaterialType;
    readonly vao: WebGLVertexArrayObject;
    readonly vaoPosOnly: WebGLVertexArrayObject | null;
    readonly posVB: WebGLBuffer;
    readonly idxBuf: WebGLBuffer | null;
    readonly highlightVB: WebGLBuffer | null;
    readonly numVertices: number;
    readonly numTriangles: number;
    readonly drawParams: DrawParams;
    readonly drawRanges: readonly MeshDrawRange[];
    readonly objectRanges: readonly MeshObjectRange[];
    readonly baseColorTexture: WebGLTexture | null;
}


function convertAttributes(attributes: VertexAttributes, buffers: readonly WebGLBuffer[]) {
    const ret: any = {};
    function convertAttrib(a: VertexAttributeData | null) {
        return a ? { ...a, buffer: buffers[a.buffer] } as VertexAttribute : null;
    }
    for (const [key, value] of Object.entries(attributes)) {
        ret[key] = convertAttrib(value);
    }
    type ConvAttr<T> = T extends null ? VertexAttribute | null : VertexAttribute;
    return ret as { [P in keyof VertexAttributes]: ConvAttr<VertexAttributes[P]> };
}

/** @internal */
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
        const { position, normal, material, objectId, texCoord, color, projectedPos, pointFactors0, pointFactors1, highlight } = convertAttributes(vertexAttributes, buffers);
        const renderAttributes = [position, normal, material, objectId, texCoord, color, projectedPos, pointFactors0, pointFactors1, highlight];
        // // add extra highlight vertex buffer and attribute
        // const highlightVB = resourceBin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: subMesh.numVertices });
        // attributes.push({ kind: "UNSIGNED_INT", buffer: highlightVB, componentType: "UNSIGNED_BYTE" });
        const posVB = position.buffer;
        const highlightVB = highlight!.buffer;

        const vao = resourceBin.createVertexArray({ attributes: renderAttributes, indices: ib });
        const vaoPosOnly = position.buffer != 0 ? resourceBin.createVertexArray({ attributes: [position], indices: ib }) : null;
        resourceBin.subordinate(vao, ...buffers.filter(buf => buf != posVB && buf != highlightVB));
        // if (ib) {
        //     resourceBin.subordinate(vao, ib);
        // }

        const drawParams: DrawParams = ib ?
            { kind: "elements", mode: subMesh.primitiveType, indexType, count } :
            { kind: "arrays", mode: subMesh.primitiveType, count };
        const baseColorTextureIndex = subMesh.baseColorTexture as number;
        const baseColorTexture = textures[baseColorTextureIndex] ?? null;
        resourceBin.addReference(baseColorTexture);
        yield { vao, vaoPosOnly, idxBuf: ib ?? null, posVB, highlightVB, drawParams, drawRanges, numVertices, numTriangles, objectRanges, materialType: materialType as unknown as MaterialType, baseColorTexture } as const satisfies Mesh;
    }
}

/** @internal */
export function updateMeshHighlights(gl: WebGL2RenderingContext, mesh: Mesh, highlights: Uint8Array | undefined) {
    const { highlightVB } = mesh;
    if (highlightVB) {
        const highlightBuffer = new Uint8Array(mesh.numVertices);
        if (highlights) {
            for (const { objectId, beginVertex, endVertex } of mesh.objectRanges) {
                const highlight = highlights[objectId];
                if (highlight) {
                    highlightBuffer.fill(highlight, beginVertex, endVertex);
                }
            }
        }
        glUpdateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: highlightBuffer, targetBuffer: highlightVB });
    }
}

/** @internal */
export function deleteMesh(resourceBin: ResourceBin, mesh: Mesh) {
    const { vao, vaoPosOnly, idxBuf, posVB, highlightVB, baseColorTexture } = mesh;
    resourceBin.removeReference(baseColorTexture);
    resourceBin.delete(vao, vaoPosOnly, idxBuf, posVB, highlightVB);
}

/** @internal */
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

/** @internal */
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
