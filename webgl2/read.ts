import type { PolledPromise, RendererContext } from ".";
import type { Pixels, ReadPixelsParams } from "./types";
import { getPixelFormatChannels, getBufferViewType } from "./util.js";

export function readPixelsAsync(context: RendererContext, params: ReadPixelsParams): PolledPromise<Pixels> {
    const { gl } = context;
    const { x, y } = params;
    const width = params.width ?? 1;
    const height = params.height ?? 1;
    const buffer = params.buffer ?? "BACK";
    const format = params.format ?? "RGBA";
    const type = params.type ?? "UNSIGNED_BYTE";
    const srcByteOffset = 0;
    const dstOffset = 0;
    const channels = getPixelFormatChannels(gl[format]);
    const ctor = getBufferViewType(gl[type]);
    const pixels = new ctor(width * height * channels);
    const target = gl.PIXEL_PACK_BUFFER;

    const buf = gl.createBuffer();
    if (!buf)
        throw new Error("Could not create buffer!");

    gl.bindBuffer(target, buf);
    gl.bufferData(target, pixels.byteLength, gl.STREAM_READ);
    gl.readBuffer(gl[buffer]);
    gl.readPixels(x, y, width, height, gl[format], gl[type], 0);
    gl.bindBuffer(target, null);

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    if (!sync)
        throw new Error("Could not create fence sync!");

    gl.flush();

    let poll: (() => boolean) = undefined!;
    const dispose = () => {
        gl.deleteSync(sync);
        gl.deleteBuffer(buf);
    };

    const waitPromise = new Promise<void>((resolve, reject) => {
        poll = () => {
            const res = gl.clientWaitSync(sync, 0, 0);
            if (res == gl.WAIT_FAILED) {
                reject();
                return true;
            }
            if (res == gl.TIMEOUT_EXPIRED) {
                return false;
            }
            resolve();
            return true;
        }
    });

    const promise = waitPromise.then(() => {
        gl.deleteSync(sync);
        gl.bindBuffer(target, buf);
        gl.getBufferSubData(target, srcByteOffset, pixels, dstOffset, length);
        gl.bindBuffer(target, null);
        gl.deleteBuffer(buf);
        return pixels;
    });

    return { promise, poll, dispose };
}
