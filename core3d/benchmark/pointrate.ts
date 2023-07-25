import { glClear, glCreateProgram, glDraw, glState, glUniformLocations } from "webgl2";
import { waitFrame, measure } from "./util";
import { Benchmark } from "./benchmark";
import { shaders } from "./shaders";

/** A basic GPU point rate profiler. */
export class PointrateProfiler {
    readonly program;
    readonly uniforms;

    /** Create GPU resources using the gl context from the specified benchmark instance. */
    constructor(readonly benchmark: Benchmark) {
        const { gl } = this.benchmark;
        this.program = glCreateProgram(gl, shaders.pointrate);
        this.uniforms = glUniformLocations(gl, this.program, ["color"]);
    }

    /**
     * Measure fill rate by rendering a series of noisy, semi-transparent point primitives.
     * @returns Primitive/point rate estimate in primitives/second.
     * @remarks
     * This test is quite inaccurate and does not match close to the nominal primitive/triangle rate of a GPU, particularly on tile based mobile GPUs.
     * Points are being used instead of triangles since they more closely reflect the maximum theoretical primitive rate of most GPUs.
     * The result should only serve as a rough estimate.
     */
    async measure() {
        const { benchmark, program, uniforms } = this;
        const { gl } = benchmark;
        const { size, numPixels } = Benchmark;
        gl.getError();
        const numOverdraws = 8;
        glState(gl, {
            viewport: { width: size, height: size },
            program,
            blend: {
                enable: false,
            },
            depth: {
                test: false,
                writeMask: false,
            },
        });

        function render(iteration: number) {
            gl.uniform4f(uniforms.color, Math.random(), Math.random(), Math.random(), 1);
            glDraw(gl, { kind: "arrays_instanced", mode: "POINTS", count: numPixels, instanceCount: numOverdraws }); // draw quad
        }

        glClear(gl, { kind: "back_buffer", color: [0, 0, 0, 1] });
        const time = await measure(render);
        const rate = numPixels * numOverdraws * 1000 / time;
        return rate;
    }
}

/*
macbook pro 13 2018 / Intel Iris Plus Graphics 655 (https://support.apple.com/kb/SP775?locale=en_US)
chrome: fr: 13.17, pr: 0.49
safari: fr: 10.1, pr: 0.07
(chrome and safari differs significantly in point rate, even on M1 mac)
(no timer webgl extensions on either browser)

macobook pro 13 M1 2020
chrome: fr: 182, pr: 1.3
safari: fr: 79, pr: 1.3

*/