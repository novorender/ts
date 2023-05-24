import { glBlit, glInvalidateFrameBuffer, glReadPixels } from "webgl2";
import { ResourceBin } from "./resource";

export const enum BufferFlags {
    color = 0x01,
    pick = 0x02,
    depth = 0x04,
    all = color | pick | depth,
};

/*
pick buffer layout
  object_id: u32
  normal: 3 x f16
  deviation: f16
  linear_depth f32
*/

export class RenderBuffers {
    readBuffersNeedUpdate = true;
    readonly textures;
    readonly renderBuffers;
    readonly frameBuffers;
    readonly readBuffers;
    private typedArrays;
    private pickFence: {
        readonly sync: WebGLSync,
        readonly promises: { readonly resolve: () => void, readonly reject: (reason: string) => void }[],
    } | undefined;

    constructor(readonly gl: WebGL2RenderingContext, readonly width: number, readonly height: number, readonly samples: number, readonly resourceBin: ResourceBin) {
        // const color = glTexture(gl, { kind: "TEXTURE_2D", width, height, internalFormat: "RGBA16F", type: "HALF_FLOAT", image: null });
        const textures = this.textures = {
            color: resourceBin.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "R11F_G11F_B10F", type: "HALF_FLOAT", image: null }),
            pick: resourceBin.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "RGBA32UI", type: "UNSIGNED_INT", image: null }), // TODO: Pack linearDepth into this buffer instead.
            depth: resourceBin.createTexture({ kind: "TEXTURE_2D", width, height, internalFormat: "DEPTH_COMPONENT32F", type: "FLOAT", image: null }),
        } as const;

        const renderBuffers = this.renderBuffers = {
            colorMSAA: samples > 1 ? resourceBin.createRenderBuffer({ internalFormat: "R11F_G11F_B10F", width, height, samples }) : null,
            depthMSAA: samples > 1 ? resourceBin.createRenderBuffer({ internalFormat: "DEPTH_COMPONENT32F", width, height, samples }) : null,
        } as const;

        this.frameBuffers = {
            color: resourceBin.createFrameBuffer({
                color: [
                    { kind: "FRAMEBUFFER", texture: textures.color },
                ],
                depth: { kind: "DRAW_FRAMEBUFFER", texture: textures.depth },
            }),
            colorMSAA: samples > 1 ? resourceBin.createFrameBuffer({
                color: [
                    { kind: "DRAW_FRAMEBUFFER", renderBuffer: renderBuffers.colorMSAA },
                ],
                depth: { kind: "DRAW_FRAMEBUFFER", renderBuffer: renderBuffers.depthMSAA },
            }) : null,
            pick: resourceBin.createFrameBuffer({
                color: [
                    null,
                    { kind: "DRAW_FRAMEBUFFER", texture: textures.pick },
                ],
                depth: { kind: "DRAW_FRAMEBUFFER", texture: textures.depth },
            }),
        } as const;

        this.readBuffers = {
            pick: resourceBin.createBuffer({ kind: "PIXEL_PACK_BUFFER", byteSize: width * height * 16, usage: "STREAM_READ" }),
        } as const;

        this.typedArrays = {
            pick: new Uint32Array(width * height * 4),
        } as const;
    }

    resolveMSAA() {
        const { gl, frameBuffers, width, height } = this;
        const { colorMSAA, color } = frameBuffers;
        if (colorMSAA) {
            glBlit(gl, { source: colorMSAA, destination: color, color: true, srcX1: width, srcY1: height, dstX1: width, dstY1: height }); // TODO: check if we can/should use a frag shader to do tonemapping on MSAA instead.
            glInvalidateFrameBuffer(gl, { kind: "FRAMEBUFFER", frameBuffer: colorMSAA, color: [true], depth: true });
        }
    }

    invalidate(frameBuffer: keyof RenderBuffers["frameBuffers"], buffers: BufferFlags) {
        const { gl, frameBuffers } = this;
        var color = (buffers & BufferFlags.color) != 0;
        var pick = (buffers & BufferFlags.pick) != 0;
        var depth = (buffers & BufferFlags.depth) != 0;
        glInvalidateFrameBuffer(gl, { kind: "DRAW_FRAMEBUFFER", frameBuffer: frameBuffers[frameBuffer], color: [color, pick], depth });
    }

    // copy framebuffer into read buffers
    private read() {
        const { gl, width, height, frameBuffers, readBuffers } = this;
        glReadPixels(gl, {
            width, height, frameBuffer: frameBuffers.pick, buffers: [
                { attachment: "COLOR_ATTACHMENT1", buffer: readBuffers.pick, format: "RGBA_INTEGER", type: "UNSIGNED_INT" },
            ]
        });
    }

    async pickBuffers() {
        if (this.readBuffersNeedUpdate && !this.pickFence) {
            const { gl } = this;
            this.read();
            this.readBuffersNeedUpdate = false;
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
            this.pickFence = { sync, promises: [] };
        }
        if (this.pickFence) {
            const { promises } = this.pickFence;
            const promise = new Promise<void>((resolve, reject) => {
                promises.push({ resolve, reject });
            });
            await promise;
            return this.typedArrays;
        } else {
            return Promise.resolve(this.typedArrays);
        }
    }

    dispose() {
        this.deletePickFence();
        this.resourceBin.dispose();
    }

    pollPickFence() {
        const { gl, pickFence, readBuffers, typedArrays } = this;
        if (pickFence) {
            const { sync, promises } = pickFence;
            const status = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
            if (status == gl.WAIT_FAILED) {
                for (const promise of promises) {
                    promise.reject("Pick failed!");
                }
                this.deletePickFence();
            } else if (status != gl.TIMEOUT_EXPIRED) {
                // we must copy read buffers into typed arrays in one go, or get annoying gl pipeline stalled warning on chrome
                // this means we allocate more memory, but this also makes subsequent picks faster.
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readBuffers.pick);
                gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, typedArrays.pick);
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
                // resolve promises
                for (const promise of promises) {
                    promise.resolve();
                }
                this.deletePickFence();
            }
        }
    }

    private deletePickFence() {
        this.gl.deleteSync(this.pickFence?.sync ?? null);
        this.pickFence = undefined;
    }
}
