import { DrawMode, DrawParams, WebGL2Renderer } from "webgl2";
import { NodeGeometry } from "./parser";
import { MaterialType } from "./schema";

export interface Mesh {
    readonly vao: WebGLVertexArrayObject;
    readonly drawParams: DrawParams;
}

// create a single(!) mesh (for both opaque, transparent, doublesided) - use sub ranges to render with different render states
export function* createMeshes(renderer: WebGL2Renderer, geometry: NodeGeometry, primitiveType: DrawMode) {
    for (const subMesh of geometry.subMeshes) {
        if (subMesh.materialType == MaterialType.transparent)
            continue;
        const vb = renderer.createBuffer({ kind: "ARRAY_BUFFER", srcData: subMesh.vertexBuffer });
        const ib = typeof subMesh.indices != "number" ? renderer.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: subMesh.indices }) : undefined;
        const count = typeof subMesh.indices == "number" ? subMesh.indices : subMesh.indices.length;
        const indexType = subMesh.indices instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT";
        const vao = renderer.createVertexArray({
            attributes: [
                { kind: "FLOAT_VEC4", buffer: vb, componentCount: 3, componentType: "SHORT", normalized: true, stride: 16, offset: 0 },
                { kind: "FLOAT_VEC3", buffer: vb, componentCount: 3, componentType: "BYTE", normalized: true, stride: 16, offset: 6 },
            ],
            indices: ib,
        });
        renderer.deleteBuffer(vb);
        if (ib) {
            renderer.deleteBuffer(ib);
        }
        const drawParams: DrawParams = { kind: "elements", mode: primitiveType, indexType, count };
        yield { vao, drawParams } as Mesh;
    }
}
