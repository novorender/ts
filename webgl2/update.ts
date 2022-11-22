import type { UpdateParams } from "./types";
import type { RendererContext } from ".";

export function update(context: RendererContext, params: UpdateParams) {
    const { gl } = context;
    const target = gl[params.kind];
    const srcOffset = params.srcOffset ?? 0;
    const targetOffset = params.targetOffset ?? 0;
    const src = params.srcData;
    const srcData = ArrayBuffer.isView(src) ? src : new Uint8Array(src);
    gl.bindBuffer(target, params.targetBuffer);
    gl.bufferSubData(target, targetOffset, srcData, srcOffset, params.size);
    gl.bindBuffer(target, null);
}