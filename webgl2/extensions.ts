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
        colorBufferFloat: gl.getExtension("EXT_color_buffer_float"), // also includes half floats
        textureFloatLinear: gl.getExtension("OES_texture_float_linear"), // also includes half floats
        parallelShaderCompile: gl.getExtension("KHR_parallel_shader_compile"),
        loseContext: gl.getExtension("WEBGL_lose_context"),
        multiDraw: gl.getExtension("WEBGL_MULTI_DRAW"),
        drawBuffersIndexed: gl.getExtension("OES_draw_buffers_indexed") as OES_draw_buffers_indexed_ext | null,
        disjointTimerQuery: gl.getExtension('EXT_disjoint_timer_query_webgl2') as EXT_disjoint_timer_query_webgl2_ext,
        provokingVertex: gl.getExtension('WEBGL_provoking_vertex') as WEBGL_provoking_vertex | null,
        textureFilterAnisotropic: gl.getExtension('EXT_texture_filter_anisotropic'),
        polygonMode: gl.getExtension("WEBGL_polygon_mode"),
    } as const;
}

const glExtensionsMap = new WeakMap<WebGL2RenderingContext, ExtensionsGL>();

export type ExtensionsGL = ReturnType<typeof getWebGL2Extensions>;

// temporary types until extensions become part of standard ts lib
export interface OES_draw_buffers_indexed_ext {
    enableiOES(target: number, index: number): void;
    disableiOES(target: number, index: number): void;
    blendEquationiOES(buf: number, mode: number): void;
    blendEquationSeparateiOES(buf: number, modeRGB: number, modeAlpha: number): void;
    blendFunciOES(buf: number, src: number, dst: number): void;
    blendFuncSeparateiOES(buf: number, srcRGB: number, dstRGB: number, srcAlpha: number, dstAlpha: number): void;
    colorMaskiOES(buf: number, r: boolean, g: boolean, b: boolean, a: boolean): void;
};

export interface EXT_disjoint_timer_query_webgl2_ext {
    readonly QUERY_COUNTER_BITS_EXT: 0x8864; // GL.QUERY_COUNTER_BITS_EXT;
    readonly TIME_ELAPSED_EXT: 0x88BF; // GL.TIME_ELAPSED_EXT;
    readonly TIMESTAMP_EXT: 0x8E28; // GL.TIMESTAMP_EXT;
    readonly GPU_DISJOINT_EXT: 0x8FBB;  // GL.GPU_DISJOINT_EXT;
    queryCounterEXT(query: WebGLQuery, target: 0x8E28 /*GL.TIMESTAMP_EXT*/): void;
}

export interface WEBGL_provoking_vertex {
    readonly FIRST_VERTEX_CONVENTION_WEBGL: 0x8E4D;
    readonly LAST_VERTEX_CONVENTION_WEBGL: 0x8E4E; // default
    readonly PROVOKING_VERTEX_WEBGL: 0x8E4F;
    provokingVertexWEBGL(provokeMode: 0x8E4D | 0x8E4E): void;
};