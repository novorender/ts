import type { VertexArrayParams } from "./types";
import type { RendererContext } from ".";

type MatrixDim = 2 | 3 | 4;

function isMatrix(size: unknown): size is readonly [MatrixDim, MatrixDim] {
    return Array.isArray(size);
}

const shaderTypeInfo = {
    "INT": { size: 1, isInteger: true, defaultComponentType: "INT" },
    "INT_VEC2": { size: 2, isInteger: true, defaultComponentType: "INT" },
    "INT_VEC3": { size: 3, isInteger: true, defaultComponentType: "INT" },
    "INT_VEC4": { size: 4, isInteger: true, defaultComponentType: "INT" },
    "UNSIGNED_INT": { size: 1, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
    "UNSIGNED_INT_VEC2": { size: 2, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
    "UNSIGNED_INT_VEC3": { size: 3, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
    "UNSIGNED_INT_VEC4": { size: 4, isInteger: true, defaultComponentType: "UNSIGNED_INT" },
    "FLOAT": { size: 1, isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_VEC2": { size: 2, isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_VEC3": { size: 3, isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_VEC4": { size: 4, isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT2": { size: [2, 2], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT3": { size: [3, 3], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT4": { size: [4, 4], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT2x3": { size: [2, 3], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT2x4": { size: [2, 4], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT3x2": { size: [3, 2], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT3x4": { size: [3, 4], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT4x2": { size: [4, 2], isInteger: false, defaultComponentType: "FLOAT" },
    "FLOAT_MAT4x3": { size: [4, 3], isInteger: false, defaultComponentType: "FLOAT" },
} as const;

export function createVertexArray(context: RendererContext, params: VertexArrayParams): WebGLVertexArrayObject {
    const { gl } = context;
    const vao = gl.createVertexArray();
    if (!vao)
        throw new Error("Could not create vao!");
    gl.bindVertexArray(vao);
    let attribIndex = 0;
    const { attributes } = params;
    for (const attribParams of attributes) {
        if (attribParams) {
            const { size, isInteger, defaultComponentType } = shaderTypeInfo[attribParams.kind];
            const componentType = attribParams.componentType ?? defaultComponentType;
            const divisor = attribParams.divisor ?? 0;
            const stride = attribParams.stride ?? 0;
            const offset = attribParams.offset ?? 0;
            const componentCount = attribParams.componentCount ?? (isMatrix(size) ? size[0] : size);
            const normalized = attribParams.normalized ?? false;
            gl.bindBuffer(gl.ARRAY_BUFFER, attribParams.buffer);
            gl.enableVertexAttribArray(attribIndex);
            if (isInteger) {
                gl.vertexAttribIPointer(attribIndex, componentCount, gl[componentType], stride, offset);
            } else {
                gl.vertexAttribPointer(attribIndex, componentCount, gl[componentType], normalized, stride, offset);
            }
            gl.vertexAttribDivisor(attribIndex, divisor);
            attribIndex++;
        }
    };
    if (params.indices) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.indices);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return vao;
}
