import { WebGL2Renderer } from "webgl2";

export class RenderBuffers {
    readonly color: WebGLTexture;
    readonly depth: WebGLTexture;
    readonly linearDepth: WebGLTexture;
    readonly normal: WebGLTexture;
    readonly info: WebGLTexture;
    readonly frameBuffer: WebGLFramebuffer;

    constructor(readonly renderer: WebGL2Renderer, width: number, height: number) {
        this.color = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RGBA16F", type: "HALF_FLOAT", image: null });
        this.depth = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "DEPTH_COMPONENT32F", type: "FLOAT", image: null });
        this.linearDepth = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "R32F", type: "FLOAT", image: null });
        this.normal = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RG16F", type: "HALF_FLOAT", image: null }); // normalized byte instead?
        this.info = renderer.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RG32UI", type: "UNSIGNED_INT", image: null });
        this.frameBuffer = renderer.createFrameBuffer({
            color: [
                { kind: "DRAW_FRAMEBUFFER", texture: this.color },
                { kind: "DRAW_FRAMEBUFFER", texture: this.linearDepth },
                { kind: "DRAW_FRAMEBUFFER", texture: this.normal },
                { kind: "DRAW_FRAMEBUFFER", texture: this.info },
            ],
            depth: { kind: "DRAW_FRAMEBUFFER", texture: this.depth },
        });
    }

    invalidate() {
        const { renderer, frameBuffer } = this;
        renderer.invalidateFrameBuffer({ kind: "DRAW_FRAMEBUFFER", frameBuffer, color: [true, true, true, true], depth: true });
    }

    dispose() {
        const { renderer, color, depth, frameBuffer } = this;
        renderer.deleteFrameBuffer(frameBuffer);
        renderer.deleteTexture(color);
        renderer.deleteTexture(depth);
    }
}

