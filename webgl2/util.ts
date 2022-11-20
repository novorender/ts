import { GL } from "./glEnum.js";


export function getPixelFormatChannels(format: number) {
    switch (format) {
        case GL.ALPHA:
        case GL.RED:
        case GL.RED_INTEGER:
            return 1;
        case GL.RG:
        case GL.RG_INTEGER:
            return 2;
        case GL.RGB:
        case GL.RGB_INTEGER:
            return 3;
        case GL.RGBA:
        case GL.RGBA_INTEGER:
            return 4;
    }
    throw new Error(`Unknown pixel format: ${format}!`);
}


export function getBufferViewType(type: number) {
    switch (type) {
        case GL.BYTE:
            return Int8Array;
        case GL.UNSIGNED_BYTE:
            return Uint8Array;
        case GL.SHORT:
            return Int16Array;
        case GL.UNSIGNED_SHORT_5_6_5:
        case GL.UNSIGNED_SHORT_4_4_4_4:
        case GL.UNSIGNED_SHORT_5_5_5_1:
        case GL.HALF_FLOAT:
        case GL.HALF_FLOAT_OES:
            return Uint16Array;
        case GL.UNSIGNED_INT:
        case GL.UNSIGNED_INT_24_8_WEBGL:
        case GL.UNSIGNED_INT_5_9_9_9_REV:
        case GL.UNSIGNED_INT_2_10_10_10_REV:
        case GL.UNSIGNED_INT_10F_11F_11F_REV:
            return Uint32Array;
        case GL.INT:
            return Int32Array;
        case GL.FLOAT:
            return Float32Array;
        // case GL.FLOAT_32_UNSIGNED_INT_24_8_REV:
        //     return null;
    }
    throw new Error(`Unknown buffer type: ${type}!`);
}

export type UniformType =
    GL.FLOAT | GL.FLOAT_VEC2 | GL.FLOAT_VEC3 | GL.FLOAT_VEC4 |
    GL.INT | GL.INT_VEC2 | GL.INT_VEC3 | GL.INT_VEC4 |
    GL.UNSIGNED_INT | GL.UNSIGNED_INT_VEC2 | GL.UNSIGNED_INT_VEC3 | GL.UNSIGNED_INT_VEC4 |
    GL.BOOL | GL.BOOL_VEC2 | GL.BOOL_VEC3 | GL.BOOL_VEC4 |
    GL.FLOAT_MAT2 | GL.FLOAT_MAT3 | GL.FLOAT_MAT4 |
    GL.FLOAT_MAT2x3 | GL.FLOAT_MAT2x4 | GL.FLOAT_MAT3x2 | GL.FLOAT_MAT3x4 | GL.FLOAT_MAT4x2 | GL.FLOAT_MAT4x3 |
    GL.SAMPLER_2D | GL.SAMPLER_2D_ARRAY | GL.SAMPLER_2D_ARRAY_SHADOW | GL.SAMPLER_2D_ARRAY_SHADOW | GL.SAMPLER_3D | GL.SAMPLER_CUBE | GL.SAMPLER_CUBE_SHADOW;

export interface UniformInfo {
    readonly name: string;
    readonly type: UniformType;
    readonly size: number; // num elements
    readonly blockIndex: number; // -1 if not in block
    readonly offset: number; // -1 if not in block
}

export function getUniformsInfo(gl: WebGL2RenderingContext, program: WebGLProgram) {
    const numUniforms = gl.getProgramParameter(program, GL.ACTIVE_UNIFORMS);
    const uniformData: any[] = [];
    const uniformIndices: number[] = [];

    for (let i = 0; i < numUniforms; ++i) {
        uniformIndices.push(i);
        uniformData.push({});
        const uniformInfo = gl.getActiveUniform(program, i)!;
        uniformData[i].name = uniformInfo.name;
    }

    function getInfo(pname: number, key: string) {
        gl.getActiveUniforms(program, uniformIndices, pname).forEach(function (value: string, idx: number) {
            uniformData[idx][key] = value;
        });
    }
    getInfo(GL.UNIFORM_TYPE, "type");
    getInfo(GL.UNIFORM_SIZE, "size");
    getInfo(GL.UNIFORM_BLOCK_INDEX, "blockIndex");
    getInfo(GL.UNIFORM_OFFSET, "offset");
    return uniformData as readonly UniformInfo[];
}

export function getAttributesInfo(gl: WebGL2RenderingContext, program: WebGLProgram) {
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    const attributes: any[] = [];
    for (let i = 0; i < numAttributes; ++i) {
        const attrib: any = {};
        const { name, size, type } = gl.getActiveAttrib(program, i)!;
        attrib.name = name;
        attrib.size = size;
        attrib.type = type;
        attributes.push(attrib);
        // if (name == "edgeMask") {
        //     gl.vertexAttribI4iv(i, [3, 0, 0, 0]);
        // }
    }
    return attributes;
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement, scale: number = window.devicePixelRatio) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const { width, height } = canvas.getBoundingClientRect();
    const displayWidth = Math.round(width * scale);
    const displayHeight = Math.round(height * scale);

    // Check if the canvas is not the same size.
    const needResize = canvas.width != displayWidth || canvas.height != displayHeight;

    if (needResize) {
        // Make the canvas the same size
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }

    return needResize;
}

