import { glClear, glCreateProgram, glDraw, glState, glUniformLocations } from "@novorender/webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

function waitSync(gl: WebGL2RenderingContext, sync: WebGLSync) {
    gl.flush();
    let resolve: (value: number) => void = undefined!;
    const promise = new Promise<number>((res) => { resolve = res; });
    (function checkSync() {
        const flags = 0; // gl.SYNC_FLUSH_COMMANDS_BIT
        const timeout = 0; // gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL
        const status = gl.clientWaitSync(sync, flags, timeout);
        switch (status) {
            case gl.TIMEOUT_EXPIRED:
                return setTimeout(checkSync);
            case gl.WAIT_FAILED:
                throw new Error('GPU Sync error!');
        }
        gl.deleteSync(sync);
        resolve(performance.now());
    })();
    return promise;
}

export class Benchmark {
    readonly canvas;
    readonly gl;
    readonly program;
    readonly uniforms;
    readonly numPixels;
    static readonly size = 1024;

    constructor() {
        const options: WebGLContextAttributes = {
            alpha: true,
            antialias: false,
            depth: true,
            desynchronized: false,
            failIfMajorPerformanceCaveat: true,
            powerPreference: "high-performance",
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            stencil: false,
        };

        const { size } = Benchmark;
        // const canvas = this.canvas = new OffscreenCanvas(size, size);
        const canvas = this.canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        this.numPixels = size * size;
        const gl = canvas.getContext("webgl2", options);
        if (!gl)
            throw new Error("Unable to create WebGL 2 context!");
        this.gl = gl;
        this.program = glCreateProgram(gl, { vertexShader, fragmentShader });
        this.uniforms = glUniformLocations(gl, this.program, ["depth"]);
    }

    dispose() {
        const { gl } = this;
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
    }

    async fillrate() {
        const { gl, program, uniforms, numPixels } = this;
        const { size } = Benchmark;
        gl.getError();
        const numFrames = 11;
        const buf = new Uint8Array(4);
        const testQuads = 100;
        glState(gl, {
            viewport: { width: size, height: size },
            program,
            depth: {
                test: true,
                writeMask: true,
            },
            uniforms: [
                { kind: "1f", location: uniforms.depth, value: 1 / (testQuads - 1) },
            ],
        });

        function measure(numQuads: number) {
            const timestamps: number[] = [];
            glClear(gl, { kind: "back_buffer", color: [0, 0, 0, 1] });
            for (let i = 0; i < numFrames; i++) {
                const v = i / numFrames;
                glClear(gl, { kind: "back_buffer", color: [v, v, v, 1] });
                if (numQuads > 0) {
                    glDraw(gl, { kind: "arrays_instanced", mode: "TRIANGLE_STRIP", count: 4, instanceCount: numQuads }); // draw quad
                }
                gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
                timestamps.push(performance.now());
            }
            const elapsed: number[] = [];
            for (let i = 0; i < timestamps.length - 1; i++) {
                elapsed.push(timestamps[i + 1] - timestamps[i + 0]);
            }
            elapsed.sort((a, b) => a - b);
            const medianTime = elapsed[Math.round(elapsed.length / 2)];
            return medianTime;
        }
        const baselineTime = measure(0);
        const fillTime = measure(testQuads);
        return fillTime - baselineTime;
    }
}