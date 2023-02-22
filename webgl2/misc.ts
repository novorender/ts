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

export function getPixelFormatChannels(format: string) {
    switch (format) {
        case "ALPHA":
        case "RED":
        case "RED_INTEGER":
            return 1;
        case "RG":
        case "RG_INTEGER":
            return 2;
        case "RGB":
        case "RGB_INTEGER":
            return 3;
        case "RGBA":
        case "RGBA_INTEGER":
            return 4;
    }
    throw new Error(`Unknown pixel format: ${format}!`);
}

export function getBufferViewType(type: string) {
    switch (type) {
        case "BYTE":
            return Int8Array;
        case "UNSIGNED_BYTE":
            return Uint8Array;
        case "SHORT":
            return Int16Array;
        case "UNSIGNED_SHORT_5_6_5":
        case "UNSIGNED_SHORT_4_4_4_4":
        case "UNSIGNED_SHORT_5_5_5_1":
        case "HALF_FLOAT":
        case "HALF_FLOAT_OES":
            return Uint16Array;
        case "UNSIGNED_INT":
        case "UNSIGNED_INT_24_8_WEBGL":
        case "UNSIGNED_INT_5_9_9_9_REV":
        case "UNSIGNED_INT_2_10_10_10_REV":
        case "UNSIGNED_INT_10F_11F_11F_REV":
            return Uint32Array;
        case "INT":
            return Int32Array;
        case "FLOAT":
            return Float32Array;
        // case "FLOAT_32_UNSIGNED_INT_24_8_REV":
        //     return null;
    }
    throw new Error(`Unknown buffer type: ${type}!`);
}
