import { glBuffer, glVertexArray, DrawParams, VertexAttribute } from "webgl2";
import { MeshDrawRange, NodeGeometry } from "./parser";
import { MaterialType } from "./schema";

export interface Mesh {
    readonly materialType: MaterialType;
    readonly vao: WebGLVertexArrayObject;
    readonly vaoPosOnly: WebGLVertexArrayObject | null;
    readonly drawParams: DrawParams;
    readonly drawRanges: readonly MeshDrawRange[];
}

export function* createMeshes(gl: WebGL2RenderingContext, geometry: NodeGeometry) {
    for (const subMesh of geometry.subMeshes) {
        if (subMesh.materialType == MaterialType.transparent)
            continue;
        const { positionBuffer, vertexBuffer, indices, drawRanges, materialType } = subMesh;
        const pos = positionBuffer ? glBuffer(gl, { kind: "ARRAY_BUFFER", srcData: positionBuffer }) : null;
        const vb = glBuffer(gl, { kind: "ARRAY_BUFFER", srcData: vertexBuffer });
        const ib = typeof indices != "number" ? glBuffer(gl, { kind: "ELEMENT_ARRAY_BUFFER", srcData: indices }) : undefined;
        const count = typeof indices == "number" ? indices : indices.length;
        const indexType = indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT";
        const attributes: VertexAttribute[] = pos ?
            [
                { kind: "FLOAT_VEC4", buffer: pos, componentCount: 3, componentType: "SHORT", normalized: true, stride: 0, offset: 0 }, // pos
                { kind: "FLOAT_VEC3", buffer: vb, componentCount: 3, componentType: "BYTE", normalized: true, stride: 8, offset: 0 }, // normal
                { kind: "UNSIGNED_INT", buffer: vb, componentType: "UNSIGNED_BYTE", stride: 8, offset: 3 }, // material index
                { kind: "UNSIGNED_INT", buffer: vb, componentType: "UNSIGNED_INT", stride: 8, offset: 4 }, // object_id
            ] :
            [
                { kind: "FLOAT_VEC4", buffer: vb, componentCount: 3, componentType: "SHORT", normalized: true, stride: 16, offset: 0 }, // pos
                { kind: "FLOAT_VEC3", buffer: vb, componentCount: 3, componentType: "BYTE", normalized: true, stride: 16, offset: 6 }, // normal
                { kind: "UNSIGNED_INT", buffer: vb, componentType: "UNSIGNED_BYTE", stride: 16, offset: 9 }, // material index
                { kind: "UNSIGNED_INT", buffer: vb, componentType: "UNSIGNED_INT", stride: 16, offset: 12 }, // object_id
            ];
        const vao = glVertexArray(gl, { attributes, indices: ib });
        const vaoPosOnly = glVertexArray(gl, { attributes: [attributes[0], null, null, null], indices: ib });
        gl.deleteBuffer(pos);
        gl.deleteBuffer(vb);
        if (ib) {
            gl.deleteBuffer(ib);
        }
        const drawParams: DrawParams = { kind: "elements", mode: subMesh.primitiveType, indexType, count };
        yield { vao, vaoPosOnly, drawParams, drawRanges, materialType } as Mesh;
    }
}
