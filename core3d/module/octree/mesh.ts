import { glBuffer, glVertexArray, DrawParams, VertexAttribute, DrawParamsArraysMultiDraw, DrawParamsElementsMultiDraw, glTexture } from "webgl2";
import { MeshDrawRange, NodeGeometry } from "./parser";
import { MaterialType, OptionalVertexAttribute } from "./schema";

export interface Mesh {
    readonly materialType: MaterialType;
    readonly vao: WebGLVertexArrayObject;
    readonly vaoPosOnly: WebGLVertexArrayObject | null;
    readonly drawParams: DrawParams;
    readonly drawRanges: readonly MeshDrawRange[];
    readonly baseColorTexture: WebGLTexture | null;
}

function layoutAttributes(attribs: readonly (VertexAttribute | null)[]): (VertexAttribute | null)[] {
    const sizes = {
        UNSIGNED_BYTE: 1,
        BYTE: 1,
        UNSIGNED_SHORT: 2,
        SHORT: 2,
        HALF_FLOAT: 2,
        UNSIGNED_INT: 4,
        INT: 4,
        FLOAT: 4,
    } as const;

    let offset = 0;
    const offsets: number[] = [];
    function alignOffset(alignment: number) {
        const padding = alignment - 1 - (offset + alignment - 1) % alignment;
        offset += padding; // pad offset to be memory aligned.
    }
    let maxAlign = 1;
    for (let i = 0; i < attribs.length; i++) {
        const attrib = attribs[i];
        if (attrib) {
            const components = attrib.componentCount ?? 1;
            const type = attrib.componentType ?? "FLOAT";
            const bytesPerElement = sizes[type];
            maxAlign = Math.max(maxAlign, bytesPerElement);
            alignOffset(bytesPerElement);
            offsets[i] = offset;
            offset += bytesPerElement * components;
        }
    }
    alignOffset(maxAlign); // align stride to largest attribute
    const stride = offset;
    return attribs.map((attrib, i) => { return attrib ? { ...attrib, offset: offsets[i], stride } as const satisfies VertexAttribute : null; });
}


export function* createMeshes(gl: WebGL2RenderingContext, geometry: NodeGeometry) {
    const textures = geometry.textures.map(ti => {
        if (ti) {
            return glTexture(gl, ti.params);
        }
    });

    for (const subMesh of geometry.subMeshes) {
        // if (subMesh.materialType == MaterialType.transparent)
        //     continue;
        const { vertexAttributes, vertexBuffers, indices, drawRanges, materialType } = subMesh;
        const buffers = vertexBuffers.map(vb => {
            return glBuffer(gl, { kind: "ARRAY_BUFFER", srcData: vb });
        })
        const ib = typeof indices != "number" ? glBuffer(gl, { kind: "ELEMENT_ARRAY_BUFFER", srcData: indices }) : undefined;
        const count = typeof indices == "number" ? indices : indices.length;
        const indexType = indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT";
        const { position, normal, material, objectId, texCoord, color, intensity, deviation } = vertexAttributes;
        const attributes = [position, normal, material, objectId, texCoord, color, intensity, deviation].
            map(a => (a ? { ...a, buffer: buffers[a.buffer] } as VertexAttribute : null));
        const vao = glVertexArray(gl, { attributes, indices: ib });
        const vaoPosOnly = position.buffer == 1 ? glVertexArray(gl, { attributes: [attributes[0]], indices: ib }) : null;
        for (const buffer of buffers) {
            gl.deleteBuffer(buffer);
        }
        if (ib) {
            gl.deleteBuffer(ib);
        }
        const drawParams: DrawParams = { kind: "elements", mode: subMesh.primitiveType, indexType, count };
        const baseColorTextureIndex = subMesh.baseColorTexture as number;
        const baseColorTexture = textures[baseColorTextureIndex] ?? null;
        yield { vao, vaoPosOnly, drawParams, drawRanges, materialType, baseColorTexture } as const satisfies Mesh;
    }
}

export function deleteMesh(gl: WebGL2RenderingContext, mesh: Mesh) {
    gl.deleteVertexArray(mesh.vao);
    gl.deleteVertexArray(mesh.vaoPosOnly);
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
            offsetsList,
            countsList
        };
    } else {
        return {
            kind: "arrays_multidraw",
            mode,
            drawCount,
            firstsList: offsetsList,
            countsList
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
