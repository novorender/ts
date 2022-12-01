import { glBuffer, glFrameBuffer, glTexture, glInvalidateFrameBuffer, glReadPixels, glDelete } from "webgl2";

export class RenderBuffers {
    readonly resources;

    constructor(readonly gl: WebGL2RenderingContext, readonly width: number, readonly height: number) {
        const color = glTexture(gl, { kind: "TEXTURE_2D", width, height, internalFormat: "RGBA16F", type: "HALF_FLOAT", image: null });
        const depth = glTexture(gl, { kind: "TEXTURE_2D", width, height, internalFormat: "DEPTH_COMPONENT32F", type: "FLOAT", image: null });
        const normal = glTexture(gl, { kind: "TEXTURE_2D", width, height, internalFormat: "RG16F", type: "HALF_FLOAT", image: null }); // normalized byte instead?
        const linearDepth = glTexture(gl, { kind: "TEXTURE_2D", width, height, internalFormat: "R32F", type: "FLOAT", image: null });
        const info = glTexture(gl, { kind: "TEXTURE_2D", width, height, internalFormat: "RG32UI", type: "UNSIGNED_INT", image: null });
        const frameBuffer = glFrameBuffer(gl, {
            color: [
                { kind: "DRAW_FRAMEBUFFER", texture: color },
                { kind: "DRAW_FRAMEBUFFER", texture: normal },
                { kind: "DRAW_FRAMEBUFFER", texture: linearDepth },
                { kind: "DRAW_FRAMEBUFFER", texture: info },
            ],
            depth: { kind: "DRAW_FRAMEBUFFER", texture: depth },
        });
        const readNormal = glBuffer(gl, { kind: "PIXEL_PACK_BUFFER", size: width * height * 4, usage: "STREAM_READ" });
        const readLinearDepth = glBuffer(gl, { kind: "PIXEL_PACK_BUFFER", size: width * height * 4, usage: "STREAM_READ" });
        const readInfo = glBuffer(gl, { kind: "PIXEL_PACK_BUFFER", size: width * height * 8, usage: "STREAM_READ" });
        this.resources = { color, depth, normal, linearDepth, info, frameBuffer, readNormal, readLinearDepth, readInfo } as const;
    }

    invalidate() {
        const { gl, resources } = this;
        // invalidate color and depth buffers only (we may need pick buffers for picking)
        glInvalidateFrameBuffer(gl, { kind: "DRAW_FRAMEBUFFER", frameBuffer: resources.frameBuffer, color: [true, false, false, false], depth: true });
    }

    // copy framebuffer into read buffers
    read() {
        const { gl, width, height, resources } = this;
        const { frameBuffer, readLinearDepth, readNormal, readInfo } = resources;
        glReadPixels(gl, {
            width, height, frameBuffer, buffers: [
                { attachment: "COLOR_ATTACHMENT1", buffer: readNormal, format: "RG", type: "HALF_FLOAT" },
                { attachment: "COLOR_ATTACHMENT2", buffer: readLinearDepth, format: "RED", type: "FLOAT" },
                { attachment: "COLOR_ATTACHMENT3", buffer: readInfo, format: "RG_INTEGER", type: "UNSIGNED_INT" },
            ]
        });
    }

    dispose() {
        const { gl, resources } = this;
        glDelete(gl, resources);
    }
}

