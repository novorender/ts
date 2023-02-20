import { GL } from "./constants.js";

export function glErrorMessage(status: number) {
    switch (status) {
        case GL.NO_ERROR: break;
        case GL.INVALID_ENUM:
            return "Invalid enum";
        case GL.INVALID_VALUE:
            return "Invalid value";
        case GL.INVALID_OPERATION:
            return "Invalid operation";
        case GL.INVALID_FRAMEBUFFER_OPERATION:
            return "Invalid framebuffer operation";
        case GL.OUT_OF_MEMORY:
            return "Out of memory";
        case GL.CONTEXT_LOST_WEBGL:
            return "Context lost";
        default:
            return "Unknown status";
    }
}

export function glAttributesInfo(gl: WebGL2RenderingContext, program: WebGLProgram) {
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    const attributes: WebGLActiveInfo[] = [];
    for (let i = 0; i < numAttributes; ++i) {
        const attrib = gl.getActiveAttrib(program, i)!;
        attributes.push(attrib);
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
