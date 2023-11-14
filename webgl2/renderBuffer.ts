import { glLimits } from "./limits";
import { GL } from "./constants.js";

export function glCreateRenderbuffer(gl: WebGL2RenderingContext, params: RenderbufferParams): WebGLRenderbuffer {
    const limits = glLimits(gl);
    const buffer = gl.createRenderbuffer()!;
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

export const renderBufferFormat = {
    [GL.R8]: "R8",
    [GL.R8UI]: "R8UI",
    [GL.R8I]: "R8I",
    [GL.R16UI]: "R16UI",
    [GL.R16I]: "R16I",
    [GL.R32UI]: "R32UI",
    [GL.R32I]:   "R32I",
    [GL.RG8]: "RG8",
    [GL.RG8UI]: "RG8UI",
    [GL.RG8I]: "RG8I",
    [GL.RG16UI]: "RG16UI",
    [GL.RG16I]: "RG16I",
    [GL.RG32UI]: "RG32UI",
    [GL.RG32I]: "RG32I",
    [GL.RGB8]:   "RGB8",
    [GL.RGBA8]: "RGBA8",
    [GL.SRGB8_ALPHA8]: "SRGB8_ALPHA8",
    [GL.RGBA4]: "RGBA4",
    [GL.RGB565]: "RGB565",
    [GL.RGB5_A1]: "RGB5_A1",
    [GL.RGB10_A2]: "RGB10_A2",
    [GL.RGBA8UI]: "RGBA8UI",
    [GL.RGBA8I]: "RGBA8I",
    [GL.RGB10_A2UI]: "RGB10_A2UI",
    [GL.RGBA16UI]: "RGBA16UI",
    [GL.RGBA16I]: "RGBA16I",
    [GL.RGBA32I]: "RGBA32I",
    [GL.RGBA32UI]:   "RGBA32UI",
    [GL.DEPTH_COMPONENT16]: "DEPTH_COMPONENT16",
    [GL.DEPTH_COMPONENT24]: "DEPTH_COMPONENT24",
    [GL.DEPTH_COMPONENT32F]: "DEPTH_COMPONENT32F",
    [GL.DEPTH24_STENCIL8]: "DEPTH24_STENCIL8",
    [GL.DEPTH32F_STENCIL8]: "DEPTH32F_STENCIL8",
    [GL.STENCIL_INDEX8]:   "STENCIL_INDEX8",
    [GL.R16F]: "R16F",
    [GL.RG16F]: "RG16F",
    [GL.RGBA16F]: "RGBA16F",
    [GL.R32F]: "R32F",
    [GL.RG32F]: "RG32F",
    [GL.RGBA32F]: "RGBA32F",
    [GL.R11F_G11F_B10F]: "R11F_G11F_B10F",
} as const; // EXT_color_buffer_float
export type RenderBufferFormat = keyof typeof renderBufferFormat;
export type RenderBufferFormatString = (typeof renderBufferFormat)[RenderBufferFormat]

export interface RenderbufferParams {
    readonly internalFormat: RenderBufferFormatString;
    readonly width: number;
    readonly height: number;
    readonly samples?: number | "max"; // default: undefined (single sampled)
};
