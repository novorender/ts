export function glVertexArray(gl: WebGL2RenderingContext, params: VertexArrayParams): WebGLVertexArrayObject {
    const vao = gl.createVertexArray()!;
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
        } else {
            gl.disableVertexAttribArray(attribIndex);
        }
        attribIndex++;
    };
    if (params.indices) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, params.indices);
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return vao;
}

export interface VertexArrayParams {
    readonly attributes: readonly (VertexAttribute | null)[];
    readonly indices?: WebGLBuffer;
}

export type VertexAttribute = VertexAttributeFloat | VertexAttributeFloatNormalized | VertexAttributeInt | VertexAttributeUint;

export type ComponentTypeFloat = "HALF_FLOAT" | "FLOAT";
export type ComponentTypeInt = "BYTE" | "SHORT" | "INT";
export type ComponentTypeUint = "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
export type ShaderTypeFloat = "FLOAT" | "FLOAT_VEC2" | "FLOAT_VEC3" | "FLOAT_VEC4" |
    // we allow matrix types as a convenience because gl.getActiveAttrib() could return such a type from a shader program.
    // each matrix row still has to be bound separately when defining attributes.
    "FLOAT_MAT2" | "FLOAT_MAT3" | "FLOAT_MAT4" | "FLOAT_MAT2x3" | "FLOAT_MAT2x4" | "FLOAT_MAT3x2" | "FLOAT_MAT3x4" | "FLOAT_MAT4x2" | "FLOAT_MAT4x3";
export type ShaderTypeInt = "INT" | "INT_VEC2" | "INT_VEC3" | "INT_VEC4";
export type ShaderTypeUint = "UNSIGNED_INT" | "UNSIGNED_INT_VEC2" | "UNSIGNED_INT_VEC3" | "UNSIGNED_INT_VEC4";
export type ShaderAttributeType = ShaderTypeFloat | ShaderTypeInt | ShaderTypeUint;

interface VertexAttributeCommon {
    readonly buffer: WebGLBuffer;
    readonly componentCount?: 1 | 2 | 3 | 4; // default: same as shader type
    readonly stride?: number; // default: 0
    readonly offset?: number; // default: 0
    readonly divisor?: number; // default: 0
}

export interface VertexAttributeFloat extends VertexAttributeCommon {
    readonly kind: ShaderTypeFloat;
    readonly componentType?: ComponentTypeFloat | ComponentTypeInt | ComponentTypeUint; // default: FLOAT
    readonly normalized?: false;
}

export interface VertexAttributeFloatNormalized extends VertexAttributeCommon {
    readonly kind: ShaderTypeFloat;
    readonly componentType?: ComponentTypeInt | ComponentTypeUint; // default: FLOAT
    readonly normalized: true;
}

export interface VertexAttributeInt extends VertexAttributeCommon {
    readonly kind: ShaderTypeInt;
    readonly componentType?: ComponentTypeInt; // default: INT
    readonly normalized?: undefined;
}

export interface VertexAttributeUint extends VertexAttributeCommon {
    readonly kind: ShaderTypeUint;
    readonly componentType?: ComponentTypeUint; // default: UNSIGNED_INT
    readonly normalized?: undefined;
}

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
