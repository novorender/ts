export function glExtensions(gl: WebGL2RenderingContext, refresh = false) {
    let ext = glExtensionsMap.get(gl);
    if (!ext || refresh) {
        ext = getWebGL2Extensions(gl);
        glExtensionsMap.set(gl, ext);
    }
    return ext;
}

function getWebGL2Extensions(gl: WebGL2RenderingContext) {
    return {
        colorBufferFloat: gl.getExtension("EXT_color_buffer_float") as WEBGL_color_buffer_float | null, // also includes half floats
        loseContext: gl.getExtension("WEBGL_lose_context") as WEBGL_lose_context | null,
        multiDraw: gl.getExtension("WEBGL_MULTI_DRAW") as WebGL_multi_draw_ext | null,
    } as const;
}

const glExtensionsMap = new WeakMap<WebGL2RenderingContext, ExtensionsGL>();

export type ExtensionsGL = ReturnType<typeof getWebGL2Extensions>;

// temporary types until extensions become part of standard ts lib
export interface WebGL_multi_draw_ext {
    multiDrawArraysWEBGL(mode: number,
        firstsList: Int32Array, firstsOffset: number,
        countsList: Int32Array, countsOffset: number,
        drawCount: number): void;
    multiDrawElementsWEBGL(mode: number,
        offsetsList: Int32Array, offsetsOffset: number,
        type: number,
        countsList: Int32Array, countsOffset: number,
        drawCount: number): void;
}

