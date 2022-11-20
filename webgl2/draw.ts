import type { RendererContext, DrawParams, DrawParamsArraysInstanced, DrawParamsArraysMultiDraw, DrawParamsElements, DrawParamsElementsInstanced, DrawParamsElementsRange } from "./";

export function draw(context: RendererContext, params: DrawParams) {
    const { gl } = context;
    const mode = params.mode ?? "TRIANGLES";
    if (isMultiDraw(params)) {
        const { multiDraw } = context.extensions;
        if (multiDraw) {
            const { drawCount } = params;
            const firstsList = params.firstsList;
            const firstsOffset = params.firstsOffset ?? 0;
            const countsList = params.countsList;
            const countsOffset = params.countsOffset ?? 0;
            multiDraw.multiDrawArraysWEBGL(gl[mode], firstsList, firstsOffset, countsList, countsOffset, drawCount);
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
    return "instanceCount" in params;
}

function isElements(params: DrawParams): params is DrawParamsElements | DrawParamsElementsInstanced | DrawParamsElementsRange {
    return "indexType" in params;
}

function isRange(params: DrawParams): params is DrawParamsElementsRange {
    return "start" in params && "end" in params;
}

function isMultiDraw(params: DrawParams): params is DrawParamsArraysMultiDraw {
    return "drawCount" in params;
}

