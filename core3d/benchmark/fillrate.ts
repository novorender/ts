import { glClear, glCreateProgram, glDraw, glState, glUniformLocations } from "webgl2";
import { measure } from "./util";
import { Benchmark } from "./benchmark";
import { shaders } from "./shaders";

export class FillrateProfiler {
    readonly program;
    readonly uniforms;

    constructor(readonly benchmark: Benchmark) {
        const { gl } = this.benchmark;
        this.program = glCreateProgram(gl, shaders.fillrate);
        this.uniforms = glUniformLocations(gl, this.program, ["seed"]);
    }

    async measure() {
        const { benchmark, program, uniforms } = this;
        const { gl } = benchmark;
        const { size, numPixels } = Benchmark;
        gl.getError();
        const numQuads = 128;
        // TODO: create dedicated framebuffer (HDRI?)
        glState(gl, {
            viewport: { width: size, height: size },
            program,
            blend: {
                enable: true,
                srcRGB: "SRC_ALPHA",
                dstRGB: "ONE_MINUS_SRC_ALPHA",
                srcAlpha: "ONE",
                dstAlpha: "ONE",
            },
            depth: {
                test: false,
                writeMask: false,
            },
        });

        function render(iteration: number) {
            gl.uniform1f(uniforms.seed, Math.random());
            // glClear(gl, { kind: "back_buffer", color: [0, 0, 0, 1] });
            glDraw(gl, { kind: "arrays_instanced", mode: "TRIANGLE_STRIP", count: 4, instanceCount: numQuads }); // draw quad
            gl.flush();
        }

        glClear(gl, { kind: "back_buffer", color: [0, 0, 0, 1] });
        const time = await measure(render);
        const rate = numPixels * numQuads * 1000 / time;
        return rate;
    }
}



/*

Fillrate (GPix/sec) = Ghz * #ROPs
3070: 1.5 * 96 = ~150
M1: 1.25 * 32 = ~40
Mali-G57 MC2 (oppo): 0.85  * 4 = ~3.4
Mail-G52 MP2 (A8): 0.95 * 4 = ~4.5
Mali-G77 MC9 (OnePlus Nord 2): 0.85 * 18 = ~46
*/