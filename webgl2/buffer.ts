import type { RendererContext, BufferParams } from ".";

// TODO: make overload interface?
export function createBuffer(context: RendererContext, params: BufferParams): WebGLBuffer {
    const { gl } = context;
    const target = gl[params.kind];
    const usage = gl[params.usage ?? "STATIC_DRAW"];
    const buffer = gl.createBuffer();
    if (!buffer)
        throw new Error("Could not create buffer!");
    gl.bindBuffer(target, buffer);
    if ("size" in params) {
        gl.bufferData(target, params.size, usage);
    } else {
        gl.bufferData(target, params.srcData, usage);
    }
    gl.bindBuffer(target, null);
    return buffer;
}
