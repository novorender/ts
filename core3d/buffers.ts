import { WebGL2Renderer } from "webgl2";

export class RenderBuffers {
    readonly color: WebGLTexture;
    readonly depth: WebGLTexture;
    readonly normal: WebGLTexture;
    readonly linearDepth: WebGLTexture;
    readonly info: WebGLTexture;
    readonly frameBuffer: WebGLFramebuffer;
    // PIXEL_PACK_BUFFER read buffers for picking
    readonly normalRead: WebGLBuffer;
    readonly linearDepthRead: WebGLBuffer;
    readonly infoRead: WebGLBuffer;

    constructor(readonly renderer: WebGL2Renderer, readonly width: number, readonly height: number) {
        this.color = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RGBA16F", type: "HALF_FLOAT", image: null });
        this.depth = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "DEPTH_COMPONENT32F", type: "FLOAT", image: null });
        this.normal = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RG16F", type: "HALF_FLOAT", image: null }); // normalized byte instead?
        this.linearDepth = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "R32F", type: "FLOAT", image: null });
        this.info = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RG32UI", type: "UNSIGNED_INT", image: null });
        this.frameBuffer = renderer.createFrameBuffer({
            color: [
                { kind: "DRAW_FRAMEBUFFER", texture: this.color },
                { kind: "DRAW_FRAMEBUFFER", texture: this.normal },
                { kind: "DRAW_FRAMEBUFFER", texture: this.linearDepth },
                { kind: "DRAW_FRAMEBUFFER", texture: this.info },
            ],
            depth: { kind: "DRAW_FRAMEBUFFER", texture: this.depth },
        });
        this.normalRead = renderer.createBuffer({ kind: "PIXEL_PACK_BUFFER", size: width * height * 4, usage: "STREAM_READ" });
        this.linearDepthRead = renderer.createBuffer({ kind: "PIXEL_PACK_BUFFER", size: width * height * 4, usage: "STREAM_READ" });
        this.infoRead = renderer.createBuffer({ kind: "PIXEL_PACK_BUFFER", size: width * height * 8, usage: "STREAM_READ" });
    }

    invalidate() {
        const { renderer, frameBuffer } = this;
        // invalidate color and depth buffers only (we may need pick buffers for picking)
        renderer.invalidateFrameBuffer({ kind: "DRAW_FRAMEBUFFER", frameBuffer, color: [true, false, false, false], depth: true });
    }

    // copy framebuffer into read buffers
    read() {
        const { renderer, width, height, frameBuffer, linearDepthRead, normalRead, infoRead } = this;
        const { gl } = renderer;
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
        gl.readBuffer(gl.COLOR_ATTACHMENT1);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, normalRead);
        gl.readPixels(0, 0, width, height, gl.RG, gl.HALF_FLOAT, 0);

        gl.readBuffer(gl.COLOR_ATTACHMENT2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, linearDepthRead);
        gl.readPixels(0, 0, width, height, gl.RED, gl.FLOAT, 0);

        gl.readBuffer(gl.COLOR_ATTACHMENT3);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, infoRead);
        gl.readPixels(0, 0, width, height, gl.RG_INTEGER, gl.UNSIGNED_INT, 0);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.readBuffer(gl.BACK);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    }

    dispose() {
        const { renderer, color, depth, linearDepth, normal, info, frameBuffer, linearDepthRead, normalRead, infoRead } = this;
        renderer.deleteFrameBuffer(frameBuffer);
        renderer.deleteTexture(color);
        renderer.deleteTexture(depth);
        renderer.deleteTexture(normal);
        renderer.deleteTexture(linearDepth);
        renderer.deleteTexture(info);
        renderer.deleteBuffer(normalRead);
        renderer.deleteBuffer(linearDepthRead);
        renderer.deleteBuffer(infoRead);
    }
}

