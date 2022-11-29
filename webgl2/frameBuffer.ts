import type { RendererContext, InvalidateFrameBufferParams, FrameBufferBinding, FrameBufferParams, FrameBufferTextureBinding } from ".";

function isTextureAttachment(attachment: FrameBufferBinding): attachment is FrameBufferTextureBinding {
    return typeof attachment == "object" && "texture" in attachment;
}

export function invalidateFrameBuffer(context: RendererContext, params: InvalidateFrameBufferParams) {
    const { gl } = context;
    const attachments: number[] = [];
    if (params.depth && params.stencil) {
        attachments.push(gl.DEPTH_STENCIL_ATTACHMENT);
    } else if (params.depth) {
        attachments.push(gl.DEPTH_ATTACHMENT);
    } else if (params.stencil) {
        attachments.push(gl.STENCIL_ATTACHMENT);
    }
    let i = 0;
    for (const invalidate of params.color) {
        if (invalidate) {
            attachments.push(gl.COLOR_ATTACHMENT0 + i);
        }
        i++;
    }
    const { frameBuffer, kind } = params;
    const target = gl[kind];
    gl.bindFramebuffer(target, frameBuffer);
    gl.invalidateFramebuffer(target, attachments);
    gl.bindFramebuffer(target, null);
}

export function createFrameBuffer(context: RendererContext, params: FrameBufferParams): WebGLFramebuffer {
    const { gl, limits } = context;

    const frameBuffer = gl.createFramebuffer()!;
    console.assert(params.color.length <= limits.MAX_COLOR_ATTACHMENTS);

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    function bind(binding: FrameBufferBinding, attachment: number) {
        const target = gl[binding.kind];
        if (isTextureAttachment(binding)) {
            const { texture } = binding;
            if (binding.layer === undefined) {
                const texTarget = gl[binding.texTarget ?? "TEXTURE_2D"];
                gl.framebufferTexture2D(target, attachment, texTarget, texture, binding.level ?? 0);
            } else {
                gl.framebufferTextureLayer(target, attachment, texture, binding.level ?? 0, binding.layer);
            }
        } else {
            const { renderBuffer } = binding;
            gl.framebufferRenderbuffer(target, attachment, gl.RENDERBUFFER, renderBuffer);
        }
    }
    if (params.depth)
        bind(params.depth, gl.DEPTH_ATTACHMENT);
    if (params.stencil)
        bind(params.stencil, gl.STENCIL_ATTACHMENT);
    let i = gl.COLOR_ATTACHMENT0;
    for (const color of params.color) {
        if (color) {
            bind(color, i);
        }
        i++;
    }

    const debug = true; // TODO: get from build environment
    if (debug) {
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        switch (status) {
            case gl.FRAMEBUFFER_COMPLETE:
                break;
            case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                throw new Error("Framebuffer incomplete attachment!");
            case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                throw new Error("Framebuffer missing attachment!")
            case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                throw new Error("Framebuffer incomplete dimensions!")
            case gl.FRAMEBUFFER_UNSUPPORTED:
                throw new Error("Framebuffer unsupported!")
            case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
                throw new Error("Framebuffer incomplete multisample!")
            default:
                throw new Error("Unknown framebuffer error!")
        }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return frameBuffer;
}