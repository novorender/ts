import { glExtensions } from "./extensions";

export function glDraw(gl: WebGL2RenderingContext, params: DrawParams) {
    const mode = params.mode ?? "TRIANGLES";
    if (isMultiDraw(params)) {
        const { multiDraw } = glExtensions(gl);
        if (multiDraw) {
            const { drawCount, countsList, countsOffset } = params;
            switch (params.kind) {
                case "arrays_multidraw":
                    const { firstsList, firstsOffset } = params;
                    multiDraw.multiDrawArraysWEBGL(gl[mode], firstsList, firstsOffset ?? 0, countsList, countsOffset ?? 0, drawCount);
                    break;
                case "elements_multidraw":
                    const { offsetsList, offsetsOffset, indexType } = params;
                    multiDraw.multiDrawElementsWEBGL(gl[mode], countsList, countsOffset ?? 0, gl[indexType], offsetsList, offsetsOffset ?? 0, drawCount);
                    break;
            }
        } else {
            console.warn("no multi_draw gl extension!");
        }
    } else {
        const { count } = params;
        if (isInstanced(params)) {
            if (isElements(params)) {
                gl.drawElementsInstanced(gl[mode], count, gl[params.indexType], params.offset ?? 0, params.instanceCount);
            } else {
                gl.drawArraysInstanced(gl[mode], params.first ?? 0, count, params.instanceCount);
            }
        } else {
            if (isElements(params)) {
                if (isRange(params)) {
                    gl.drawRangeElements(gl[mode], params.minIndex, params.maxIndex, count, gl[params.indexType], params.offset ?? 0);
                } else {
                    gl.drawElements(gl[mode], count, gl[params.indexType], params.offset ?? 0);
                }
            } else {
                gl.drawArrays(gl[mode], params.first ?? 0, count);
            }
        }
    }
}

function isInstanced(params: DrawParams): params is DrawParamsArraysInstanced | DrawParamsElementsInstanced {
    return "instanceCount" in params && params.instanceCount != undefined;
}

function isElements(params: DrawParams): params is DrawParamsElements | DrawParamsElementsInstanced | DrawParamsElementsRange | DrawParamsElementsMultiDraw {
    return "indexType" in params && params.indexType != undefined;
}

function isRange(params: DrawParams): params is DrawParamsElementsRange {
    return "start" in params && "end" in params && params.start != undefined;
}

function isMultiDraw(params: DrawParams): params is DrawParamsArraysMultiDraw | DrawParamsElementsMultiDraw {
    return "drawCount" in params && params.drawCount != undefined;
}

export type DrawParams =
    DrawParamsArrays | DrawParamsArraysMultiDraw | DrawParamsArraysInstanced |
    DrawParamsElements | DrawParamsElementsRange | DrawParamsElementsMultiDraw | DrawParamsElementsInstanced;
// TODO: Add multi_draw_instanced variants for arrays and elements

export type DrawMode = "POINTS" | "LINE_STRIP" | "LINE_LOOP" | "LINES" | "TRIANGLE_STRIP" | "TRIANGLE_FAN" | "TRIANGLES";

export interface DrawParamsBase {
    readonly mode?: DrawMode; // default: TRIANGLES
}

export interface DrawParamsArrays extends DrawParamsBase {
    /** Equivalent to gl.drawArrays() */
    readonly kind: "arrays",
    readonly count: number;
    readonly first?: number; // default: 0
}

export interface DrawParamsArraysMultiDraw extends DrawParamsBase {
    /** Equivalent to `ext.multiDrawArraysWEBGL()` */
    readonly kind: "arrays_multidraw",
    readonly drawCount: number;
    readonly firstsList: Int32Array;
    readonly firstsOffset?: number; // default: 0
    readonly countsList: Int32Array;
    readonly countsOffset?: number; // default: 0
}

export interface DrawParamsElements extends DrawParamsBase {
    /** Equivalent to gl.drawElements() */
    readonly kind: "elements",
    /** # of indices to draw */
    readonly count: number;
    /** Type of indices */
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    /** Byte offset in the element array buffer. Must be a valid multiple of the size of the given type. */
    readonly offset?: number; // default: 0
}

export interface DrawParamsElementsRange extends DrawParamsBase {
    /** Equivalent to gl.drawRangeElements() */
    readonly kind: "elements_range",
    /** # of indices to draw */
    readonly count: number;
    /** Type of indices */
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    /** Byte offset in the element array buffer. Must be a valid multiple of the size of the given type. */
    readonly offset?: number; // default: 0
    /** The minimum array index contained in buffer range. */
    readonly minIndex: number; // start vertex index
    /** The maximum array index contained in buffer range. */
    readonly maxIndex: number; // end vertex index
}

export interface DrawParamsElementsMultiDraw extends DrawParamsBase {
    /** Equivalent to `ext.multiDrawArraysWEBGL()` */
    readonly kind: "elements_multidraw",
    readonly drawCount: number;
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    readonly offsetsList: Int32Array;
    readonly offsetsOffset?: number; // default: 0
    readonly countsList: Int32Array;
    readonly countsOffset?: number; // default: 0
}

export interface DrawParamsArraysInstanced extends DrawParamsBase {
    /** Equivalent to gl.drawArraysInstanced() */
    readonly kind: "arrays_instanced",
    readonly count: number;
    readonly instanceCount: number;
    readonly first?: number; // default: 0
}

export interface DrawParamsElementsInstanced extends DrawParamsBase {
    /** Equivalent to gl.drawElementsInstanced() */
    readonly kind: "elements_instanced",
    readonly count: number;
    readonly instanceCount: number;
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    readonly offset?: number; // default: 0
}

