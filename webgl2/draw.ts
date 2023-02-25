import { glExtensions } from "./extensions";

export function glDraw(gl: WebGL2RenderingContext, params: DrawParams): DrawStatistics {
    let numPrimitives = 0;
    const mode = params.mode ?? "TRIANGLES";
    const primitiveType = gl[mode];
    if (isMultiDraw(params)) {
        const { multiDraw } = glExtensions(gl);
        if (multiDraw) {
            const { drawCount, counts, countsOffset } = params;
            switch (params.kind) {
                case "arrays_multidraw":
                    const { firstsList, firstsOffset } = params;
                    multiDraw.multiDrawArraysWEBGL(primitiveType, firstsList, firstsOffset ?? 0, counts, countsOffset ?? 0, drawCount);
                    break;
                case "elements_multidraw":
                    const { byteOffsets, byteOffsetsOffset, indexType } = params;
                    multiDraw.multiDrawElementsWEBGL(primitiveType, counts, countsOffset ?? 0, gl[indexType], byteOffsets, byteOffsetsOffset ?? 0, drawCount);
                    break;
            }
            const offs = countsOffset ?? 0;
            for (let i = 0; i < drawCount; i++) {
                numPrimitives += calcNumPrimitives(counts[i + offs], mode);
            }
        } else {
            console.warn("no multi_draw gl extension!");
        }
    } else {
        const { count } = params;
        if (isInstanced(params)) {
            const { instanceCount } = params;
            numPrimitives = calcNumPrimitives(count, mode) * instanceCount;
            if (isElements(params)) {
                gl.drawElementsInstanced(primitiveType, count, gl[params.indexType], params.byteOffset ?? 0, instanceCount);
            } else {
                gl.drawArraysInstanced(primitiveType, params.first ?? 0, count, instanceCount);
            }
        } else {
            numPrimitives = calcNumPrimitives(count, mode);
            if (isElements(params)) {
                if (isRange(params)) {
                    gl.drawRangeElements(primitiveType, params.minIndex, params.maxIndex, count, gl[params.indexType], params.byteOffset ?? 0);
                } else {
                    gl.drawElements(primitiveType, count, gl[params.indexType], params.byteOffset ?? 0);
                }
            } else {
                gl.drawArrays(primitiveType, params.first ?? 0, count);
            }
        }
    }

    if (primitiveType >= gl.TRIANGLES) {
        return { points: 0, lines: 0, triangles: numPrimitives };
    } else if (primitiveType >= gl.LINES) {
        return { points: 0, lines: numPrimitives, triangles: 0 };
    } else {
        return { points: numPrimitives, lines: 0, triangles: 0 };
    }
}

function calcNumPrimitives(vertexCount: number, primitiveType: string) {
    switch (primitiveType) {
        case "TRIANGLES":
            return vertexCount / 3;
        case "TRIANGLE_STRIP":
        case "TRIANGLE_FAN":
            return vertexCount - 2;
        case "LINES":
            return vertexCount / 2;
        case "LINE_STRIP":
            return vertexCount - 1;
        default:
            return vertexCount;
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

export type DrawStatistics =
    { readonly points: number; readonly lines: 0; readonly triangles: 0 } |
    { readonly points: 0; readonly lines: number; readonly triangles: 0 } |
    { readonly points: 0; readonly lines: 0; readonly triangles: number };

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
    readonly counts: Int32Array;
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
    readonly byteOffset?: number; // default: 0
}

export interface DrawParamsElementsRange extends DrawParamsBase {
    /** Equivalent to gl.drawRangeElements() */
    readonly kind: "elements_range",
    /** # of indices to draw */
    readonly count: number;
    /** Type of indices */
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    /** Byte offset in the element array buffer. Must be a valid multiple of the size of the given type. */
    readonly byteOffset?: number; // default: 0
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
    readonly byteOffsets: Int32Array;
    readonly byteOffsetsOffset?: number; // default: 0
    readonly counts: Int32Array;
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
    readonly byteOffset?: number; // default: 0
}

