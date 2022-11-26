import type { State } from ".";
import { createDefaultState } from "./state.js";

export interface RendererContext {
    readonly gl: WebGL2RenderingContext;
    readonly limits: LimitsGL;
    readonly extensions: {
        readonly loseContext: WebGLLoseContextExt | null;
        readonly multiDraw: WebGLMultiDrawExt | null;
    }
    readonly defaultState: State;
}

export interface WebGLLoseContextExt {
    loseContext(): void;
    restoreContext(): void;
}

export interface WebGLMultiDrawExt {
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

export function createContext(gl: WebGL2RenderingContext) {
    const limits = getLimits(gl);
    const defaultState = createDefaultState(limits);
    const extensions = {
        loseContext: gl.getExtension("WEBGL_lose_context ") as WebGLLoseContextExt,
        multiDraw: gl.getExtension("WEBGL_MULTI_DRAW") as WebGLMultiDrawExt,
    } as const;
    return { gl, extensions, limits, defaultState, currentProgram: null } as const;
}

export function getLimits(gl: WebGL2RenderingContext) {
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
export type LimitsGL = ReturnType<typeof getLimits>;

