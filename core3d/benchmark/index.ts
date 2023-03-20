import { glClear } from "@novorender/webgl2";

export class Benchmark {
    readonly canvas;
    readonly gl;
    readonly numPixels;

    constructor() {
        const options: WebGLContextAttributes = {
            alpha: true,
            antialias: false,
            depth: false,
            desynchronized: false,
            failIfMajorPerformanceCaveat: true,
            powerPreference: "high-performance",
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            stencil: false,
        };

        const size = 256;
        const canvas = this.canvas = new OffscreenCanvas(size, size); // document.createElement("canvas");
        // canvas.width = size;
        // canvas.height = size;
        this.numPixels = size * size;
        const gl = canvas.getContext("webgl2", options);
        if (!gl)
            throw new Error("Unable to create WebGL 2 context!");
        this.gl = gl;
    }

    dispose() {
        const { gl } = this;
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
    }

    clearRate() {
        const { gl, numPixels } = this;
        gl.getError();
        const begin = performance.now();
        const numFrames = 256;
        const buf = new Uint8Array(4);
        for (let i = 0; i < numFrames; i++) {
            const v = i / numFrames;
            glClear(gl, { kind: "back_buffer", color: [v, v, v, 1] });
            gl.readPixels(v, v, v, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        }
        gl.getError();
        const end = performance.now();
        const time = end - begin;
        return numFrames / time;
    }
}