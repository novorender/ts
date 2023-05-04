import { glClear, glCreateProgram, glDraw, glState, glUniformLocations } from "@novorender/webgl2";
import { waitFrame, measure } from "./util";
import { Benchmark } from "./benchmark";
import { shaders } from "./shaders";

export class PointrateProfiler {
    readonly program;
    readonly uniforms;

    constructor(readonly benchmark: Benchmark) {
        const { gl } = this.benchmark;
        this.program = glCreateProgram(gl, shaders.pointrate);
        this.uniforms = glUniformLocations(gl, this.program, ["color"]);
    }

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
