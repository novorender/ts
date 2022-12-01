import { getPixelFormatChannels, getBufferViewType } from "./misc.js";

export function glReadPixels(gl: WebGL2RenderingContext, params: ReadPixelsParams) {
    const x = params.x ?? 0;
    const y = params.y ?? 0;
    const width = params.width ?? gl.drawingBufferWidth;
    const height = params.height ?? gl.drawingBufferHeight;
    gl.bindFramebuffer(gl.FRAMEBUFFER, params.frameBuffer);
    for (const { buffer, attachment, format, type } of params.buffers) {
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
        gl.readBuffer(gl[attachment]);
        gl.readPixels(x, y, width, height, gl[format], gl[type], 0);
    }
    // reset state
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.readBuffer(gl.BACK);
}



export function glReadPixelsAsync(gl: WebGL2RenderingContext, params: ReadPixelsAsyncParams): PolledPromise<Pixels> {
    const { x, y } = params;
    const width = params.width ?? 1;
    const height = params.height ?? 1;
    const buffer = params.attachment ?? "BACK";
    const format = params.format ?? "RGBA";
    const type = params.type ?? "UNSIGNED_BYTE";
    const srcByteOffset = 0;
    const dstOffset = 0;
    const channels = getPixelFormatChannels(gl[format]);
    const ctor = getBufferViewType(gl[type]);
    const pixels = new ctor(width * height * channels);
    const target = gl.PIXEL_PACK_BUFFER;

    const buf = gl.createBuffer()!;

    gl.bindBuffer(target, buf);
    gl.bufferData(target, pixels.byteLength, gl.STREAM_READ);
    gl.readBuffer(gl[buffer]);
    gl.readPixels(x, y, width, height, gl[format], gl[type], 0);
    gl.bindBuffer(target, null);

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;

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

export interface ReadPixelsParams {
    readonly x?: number; // default: 0
    readonly y?: number; // default: 0
    readonly width?: number; // default: gl.drawingBufferWidth
    readonly height?: number; // default: gl.drawingBufferHeight
    readonly frameBuffer: WebGLFramebuffer | null;
    readonly buffers: readonly ReadPixelsBuffer[];
}

export interface ReadPixelsBuffer {
    readonly attachment: AttachmentType;
    readonly buffer: WebGLBuffer;
    readonly format: PixelFormat;
    readonly type: PixelType;
}

export interface ReadPixelsAsyncParams {
    readonly x: number;
    readonly y: number;
    readonly width?: number; // default: 1
    readonly height?: number; // default: 1
    readonly attachment?: AttachmentType; // default: BACK
    readonly format?: PixelFormat; // default: RGBA
    readonly type?: PixelType; // default: UNSIGNED_BYTE
}

export type AttachmentType = "BACK" | `COLOR_ATTACHMENT${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15}`;
export type PixelFormat = "ALPHA" | "RGB" | "RGBA" | "RED" | "RG" | "RED_INTEGER" | "RG_INTEGER" | "RGB_INTEGER" | "RGBA_INTEGER";
export type PixelType = "UNSIGNED_BYTE" | "UNSIGNED_SHORT_5_6_5" | "UNSIGNED_SHORT_4_4_4_4" | "UNSIGNED_SHORT_5_5_5_1" | "FLOAT" | "BYTE" | "UNSIGNED_INT_2_10_10_10_REV" | "HALF_FLOAT" | "SHORT" | "UNSIGNED_SHORT" | "INT" | "UNSIGNED_INT" | "UNSIGNED_INT_10F_11F_11F_REV" | "UNSIGNED_INT_10F_11F_11F_REV";
export type Pixels = Float32Array | Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array;

export interface PolledPromise<T = any> {
    promise: Promise<T>;
    poll(): boolean;
    dispose(): void;
};

