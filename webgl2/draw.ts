import type { RendererContext, DrawParams, DrawParamsArraysInstanced, DrawParamsArraysMultiDraw, DrawParamsElements, DrawParamsElementsInstanced, DrawParamsElementsRange, DrawParamsElementsMultiDraw } from "./";

export function draw(context: RendererContext, params: DrawParams) {
    const { gl } = context;
    const mode = params.mode ?? "TRIANGLES";
    if (isMultiDraw(params)) {
        const { multiDraw } = context.extensions;
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
    return "instanceCount" in params;
}

function isElements(params: DrawParams): params is DrawParamsElements | DrawParamsElementsInstanced | DrawParamsElementsRange | DrawParamsElementsMultiDraw {
    return "indexType" in params;
}

function isRange(params: DrawParams): params is DrawParamsElementsRange {
    return "start" in params && "end" in params;
}

function isMultiDraw(params: DrawParams): params is DrawParamsArraysMultiDraw | DrawParamsElementsMultiDraw {
    return "drawCount" in params;
}

