export function glLimits(gl: WebGL2RenderingContext) {
    let ext = glLimitsMap.get(gl);
    if (!ext) {
        ext = getWebGL2Limits(gl);
        glLimitsMap.set(gl, ext);
    }
    return ext;
}

const glLimitsMap = new WeakMap<WebGL2RenderingContext, LimitsGL>();

function getWebGL2Limits(gl: WebGL2RenderingContext) {
    const names = [
        "MAX_TEXTURE_SIZE",
        "MAX_VIEWPORT_DIMS",
        "MAX_TEXTURE_IMAGE_UNITS",
        "MAX_VERTEX_UNIFORM_VECTORS",
        "MAX_VARYING_VECTORS",
        "MAX_VERTEX_ATTRIBS",
        "MAX_COMBINED_TEXTURE_IMAGE_UNITS",
        "MAX_VERTEX_TEXTURE_IMAGE_UNITS",
        "MAX_TEXTURE_IMAGE_UNITS",
        "MAX_FRAGMENT_UNIFORM_VECTORS",
        "MAX_CUBE_MAP_TEXTURE_SIZE",
        "MAX_RENDERBUFFER_SIZE",
        "MAX_3D_TEXTURE_SIZE",
        "MAX_ELEMENTS_VERTICES",
        "MAX_ELEMENTS_INDICES",
        "MAX_TEXTURE_LOD_BIAS",
        "MAX_FRAGMENT_UNIFORM_COMPONENTS",
        "MAX_VERTEX_UNIFORM_COMPONENTS",
        "MAX_ARRAY_TEXTURE_LAYERS",
        "MIN_PROGRAM_TEXEL_OFFSET",
        "MAX_PROGRAM_TEXEL_OFFSET",
        "MAX_VARYING_COMPONENTS",
        "MAX_VERTEX_OUTPUT_COMPONENTS",
        "MAX_FRAGMENT_INPUT_COMPONENTS",
        "MAX_SERVER_WAIT_TIMEOUT",
        "MAX_ELEMENT_INDEX",
        "MAX_DRAW_BUFFERS",
        "MAX_COLOR_ATTACHMENTS",
        "MAX_SAMPLES",
        "MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS",
        "MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS",
        "MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS",
        "MAX_VERTEX_UNIFORM_BLOCKS",
        "MAX_FRAGMENT_UNIFORM_BLOCKS",
        "MAX_COMBINED_UNIFORM_BLOCKS",
        "MAX_UNIFORM_BUFFER_BINDINGS",
        "MAX_UNIFORM_BLOCK_SIZE",
        "MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS",
        "MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS",
    ] as const;

    type Limits = { [P in typeof names[number]]: number };
    const limits = {} as Limits;
    for (const name of names) {
        limits[name] = gl.getParameter(gl[name]) as number;
    }
    return limits as Readonly<Limits>;
}

export type LimitsGL = ReturnType<typeof getWebGL2Limits>;
