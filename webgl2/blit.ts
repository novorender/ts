/** @public */
export function glBlit(gl: WebGL2RenderingContext, params: BlitParams) {
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    let mask = 0;
    if (params.color)
        mask |= gl.COLOR_BUFFER_BIT;
    if (params.depth)
        mask |= gl.DEPTH_BUFFER_BIT;
    if (params.stencil)
        mask |= gl.STENCIL_BUFFER_BIT;
    const filter = gl[params.filter ?? "NEAREST"];
    const srcX0 = params.srcX0 ?? 0;
    const srcY0 = params.srcY0 ?? 0;
    const srcX1 = params.srcX1 ?? w;
    const srcY1 = params.srcY1 ?? h;
    const dstX0 = params.dstX0 ?? 0;
    const dstY0 = params.dstY0 ?? 0;
    const dstX1 = params.dstX1 ?? w;
    const dstY1 = params.dstY1 ?? h;
    const src = params.source == null ? null : params.source;
    const dst = params.destination == null ? null : params.destination;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
    gl.blitFramebuffer(srcX0, srcY0, srcX1, srcY1, dstX0, dstY0, dstX1, dstY1, mask, filter);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

export interface BlitParams {
    readonly source: WebGLFramebuffer | null;
    readonly destination: WebGLFramebuffer | null;

    readonly color?: true;
    readonly depth?: true;
    readonly stencil?: true;

    readonly filter?: "NEAREST" | "LINEAR"; // "NEAREST"

    readonly srcX0?: number; // default: 0
    readonly srcY0?: number; // default: 0
    readonly srcX1?: number; // default: width
    readonly srcY1?: number; // default: height

    readonly dstX0?: number; // default: 0
    readonly dstY0?: number; // default: 0
    readonly dstX1?: number; // default: width
    readonly dstY1?: number; // default: height
}
