export function glClear(gl: WebGL2RenderingContext, params: ClearParams) {
    const { kind } = params;
    switch (kind) {
        case "back_buffer": {
            let bits = 0;
            if (params.color != undefined) {
                gl.clearColor(...params.color);
                bits |= gl.COLOR_BUFFER_BIT;
            }
            if (params.depth != undefined) {
                gl.clearDepth(params.depth);
                bits |= gl.DEPTH_BUFFER_BIT;
            }
            if (params.stencil != undefined) {
                gl.clearStencil(params.stencil);
                bits |= gl.STENCIL_BUFFER_BIT;
            }
            if (bits) {
                gl.clear(bits);
            }
            break;
        }
        case "DEPTH":
        case "STENCIL":
        case "DEPTH_STENCIL": {
            const { drawBuffer } = params;
            const depth = "depth" in params ? params.depth : 1.0;
            const stencil = "stencil" in params ? params.stencil : 0;
            gl.clearBufferfi(gl[kind], drawBuffer ?? 0, depth, stencil);
            break;
        }
        case "COLOR": {
            const { drawBuffer } = params;
            const type = params.type ?? "Float";
            const target = gl.COLOR;
            const color = params.color ?? [0, 0, 0, 0];
            switch (type) {
                case "Float": gl.clearBufferfv(target, drawBuffer ?? 0, color); break;
                case "Int": gl.clearBufferiv(target, drawBuffer ?? 0, color); break;
                case "Uint": gl.clearBufferuiv(target, drawBuffer ?? 0, color); break;
                default: exhaustiveColorCheck(type);
            }
            break;
        }
        default: exhaustiveBufferCheck(kind);
    }
}

export type ClearParams = ClearParamsBack | ClearParamsColor | ClearDepth | ClearStencil | ClearDepthStencil;

export interface ClearParamsBack {
    readonly kind: "back_buffer";
    readonly color?: readonly [red: number, green: number, blue: number, alpha: number]; // default: [0, 0, 0, 1]
    readonly depth?: number;
    readonly stencil?: number;
}

export interface ClearParamsColor {
    readonly kind: "COLOR";
    readonly drawBuffer?: number; // 0 - MAX_DRAW_BUFFERS, default: 0
    readonly color?: readonly [red: number, green: number, blue: number, alpha: number]; // default: [0, 0, 0, 1]
    readonly type?: "Int" | "Uint" | "Float"; // default: Float
}

export interface ClearDepth {
    readonly kind: "DEPTH";
    readonly drawBuffer?: number; // 0 - MAX_DRAW_BUFFERS, default: 0
    readonly depth: number;
}
export interface ClearStencil {
    readonly kind: "STENCIL";
    readonly drawBuffer?: number; // 0 - MAX_DRAW_BUFFERS, default: 0
    readonly stencil: number;
}
export interface ClearDepthStencil {
    readonly kind: "DEPTH_STENCIL";
    readonly drawBuffer?: number; // 0 - MAX_DRAW_BUFFERS, default: 0
    readonly depth: number;
    readonly stencil: number;
}

function exhaustiveBufferCheck(value: never) {
    throw new Error(`Unknown buffer type: ${value}!`);
}

function exhaustiveColorCheck(value: never) {
    throw new Error(`Unknown clear color type: ${value}!`);
}

