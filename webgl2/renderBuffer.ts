import type { RenderBufferParams } from "./types";
import type { RendererContext } from ".";

export function createRenderBuffer(context: RendererContext, params: RenderBufferParams): WebGLRenderbuffer {
    const { gl, limits } = context;
    const buffer = gl.createRenderbuffer();
    if (!buffer)
        throw new Error("Could not create render buffer!");
    const { internalFormat, width, height } = params;
    const samples = params.samples == undefined ? 1 : params.samples === "max" ? limits.MAX_SAMPLES : params.samples;
    console.assert(samples <= limits.MAX_SAMPLES);
    gl.bindRenderbuffer(gl.RENDERBUFFER, buffer);
    if (params.samples === undefined) {
        gl.renderbufferStorage(gl.RENDERBUFFER, gl[internalFormat], width, height);
    } else {
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl[internalFormat], width, height);
    }
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    return buffer;
}