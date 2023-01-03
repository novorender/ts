import { glBuffer, glFrameBuffer, glTexture, glInvalidateFrameBuffer, glReadPixels, glDelete } from "webgl2";

export class RenderBuffers {
    readBuffersNeedUpdate = true;
    readonly resources;
    private pick;
    private pickFence: {
        readonly sync: WebGLSync,
        readonly promises: { readonly resolve: () => void, readonly reject: (reason: string) => void }[],
    } | undefined;

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
        this.pick = {
            normals: new Uint16Array(width * height * 2),
            depths: new Float32Array(width * height * 1),
            infos: new Uint32Array(width * height * 2),
        } as const;
    }

    invalidate() {
        const { gl, resources } = this;
        // invalidate color and depth buffers only (we may need pick buffers for picking)
        glInvalidateFrameBuffer(gl, { kind: "DRAW_FRAMEBUFFER", frameBuffer: resources.frameBuffer, color: [true, false, false, false], depth: true });
    }

    // copy framebuffer into read buffers
    private read() {
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
            return this.pick;
        } else {
            return Promise.resolve(this.pick);
        }
    }

    dispose() {
        const { gl, resources } = this;
        this.deletePickFence();
        glDelete(gl, resources);
    }

    pollPickFence() {
        const { gl, pickFence, resources, pick } = this;
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
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readNormal);
                gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pick.normals);
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readLinearDepth);
                gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pick.depths);
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readInfo);
                gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pick.infos);
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

