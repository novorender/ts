import type { RendererContext, ClearParams } from ".";

function exhaustiveBufferCheck(value: never) {
    throw new Error(`Unknown buffer type: ${value}!`);
}

function exhaustiveColorCheck(value: never) {
    throw new Error(`Unknown clear color type: ${value}!`);
}

export function clear(context: RendererContext, params: ClearParams) {
    const { gl } = context;
    const { kind } = params;
    const drawBuffer = "drawBuffer" in params ? params.drawBuffer : 0;
    switch (kind) {
        case "DEPTH":
        case "STENCIL":
        case "DEPTH_STENCIL": {
            const depth = "depth" in params ? params.depth : 1.0;
            const stencil = "stencil" in params ? params.stencil : 0;
            gl.clearBufferfi(gl[kind], 0, depth, stencil);
            break;
        }
        case undefined:
        case "BACK": {
            const color = params.color ?? [0, 0, 0, 0];
            gl.clearColor(...color);
            gl.clear(gl.COLOR_BUFFER_BIT);
            break;
        }
        case "COLOR": {
            const type = params.type ?? "Float";
            const target = gl.COLOR;
            const color = params.color ?? [0, 0, 0, 0];
            switch (type) {
                case "Float": gl.clearBufferfv(target, drawBuffer ?? 0, color); break;
                case "Int": gl.clearBufferiv(target, drawBuffer ?? 0, new Int32Array(color)); break;
                case "Uint": gl.clearBufferuiv(target, drawBuffer ?? 0, new Uint32Array(color)); break;
                default: exhaustiveColorCheck(type);
            }
            break;
        }
        default: exhaustiveBufferCheck(kind);
    }
}