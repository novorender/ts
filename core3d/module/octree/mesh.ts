import { glBuffer, glVertexArray, DrawMode, DrawParams } from "webgl2";
import { MeshDrawRange, NodeGeometry } from "./parser";
import { MaterialType } from "./schema";

export interface Mesh {
    readonly materialType: MaterialType;
    readonly vao: WebGLVertexArrayObject;
    readonly drawParams: DrawParams;
    readonly drawRanges: readonly MeshDrawRange[];
}

// create a single(!) mesh (for both opaque, transparent, doublesided) - use sub ranges to render with different render states
export function* createMeshes(gl: WebGL2RenderingContext, geometry: NodeGeometry, primitiveType: DrawMode) {
    for (const subMesh of geometry.subMeshes) {
        if (subMesh.materialType == MaterialType.transparent)
            continue;
        const vb = glBuffer(gl, { kind: "ARRAY_BUFFER", srcData: subMesh.vertexBuffer });
        const ib = typeof subMesh.indices != "number" ? glBuffer(gl, { kind: "ELEMENT_ARRAY_BUFFER", srcData: subMesh.indices }) : undefined;
        const count = typeof subMesh.indices == "number" ? subMesh.indices : subMesh.indices.length;
        const indexType = subMesh.indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT";
        const vao = glVertexArray(gl, {
            attributes: [
                { kind: "FLOAT_VEC4", buffer: vb, componentCount: 3, componentType: "SHORT", normalized: true, stride: 16, offset: 0 }, // pos
                { kind: "FLOAT_VEC3", buffer: vb, componentCount: 3, componentType: "BYTE", normalized: true, stride: 16, offset: 6 }, // normal
                { kind: "UNSIGNED_INT", buffer: vb, componentType: "UNSIGNED_BYTE", stride: 16, offset: 9 }, // material index
                // highlight index
                // texture?
                { kind: "UNSIGNED_INT", buffer: vb, componentType: "UNSIGNED_INT", stride: 16, offset: 12 }, // object_id
            ],
            indices: ib,
        });
        gl.deleteBuffer(vb);
        if (ib) {
            gl.deleteBuffer(ib);
        }
        const drawParams: DrawParams = { kind: "elements", mode: primitiveType, indexType, count };
        const { drawRanges, materialType } = subMesh;
        yield { vao, drawParams, drawRanges, materialType } as Mesh;
    }
}
