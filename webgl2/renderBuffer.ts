import { glLimits } from "./limits";

export function glRenderBuffer(gl: WebGL2RenderingContext, params: RenderBufferParams): WebGLRenderbuffer {
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

export type RenderBufferFormat =
    "R8" | "R8UI" | "R8I" | "R16UI" | "R16I" | "R32UI" | "R32I" |
    "RG8" | "RG8UI" | "RG8I" | "RG16UI" | "RG16I" | "RG32UI" | "RG32I" | "RGB8" |
    "RGBA8" | "SRGB8_ALPHA8" | "RGBA4" | "RGB565" | "RGB5_A1" | "RGB10_A2" | "RGBA8UI" | "RGBA8I" | "RGB10_A2UI" | "RGBA16UI" | "RGBA16I" | "RGBA32I" | "RGBA32UI" |
    "DEPTH_COMPONENT16" | "DEPTH_COMPONENT24" | "DEPTH_COMPONENT32F" | "DEPTH_STENCIL" | "DEPTH24_STENCIL8" | "DEPTH32F_STENCIL8" | "STENCIL_INDEX8";

export interface RenderBufferParams {
    readonly internalFormat: RenderBufferFormat;
    readonly width: number;
    readonly height: number;
    readonly samples?: number | "max"; // default: undefined (single sampled)
};
