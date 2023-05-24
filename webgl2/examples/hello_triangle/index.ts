import { glClear, glCreateBuffer, glCreateProgram, glCreateVertexArray, glDraw, glState } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export async function hello_triangle(gl: WebGL2RenderingContext) {
    const { width, height } = gl.canvas;
    const program = glCreateProgram(gl, { vertexShader, fragmentShader });
    const vb = glCreateBuffer(gl, { kind: "ARRAY_BUFFER", srcData: new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]) });
    const vao = glCreateVertexArray(gl, { attributes: [{ kind: "FLOAT_VEC2", buffer: vb }] });

    glState(gl, {
        viewport: { width, height },
        program,
        vertexArrayObject: vao,
    });

    glClear(gl, { kind: "back_buffer", color: [0, 0, .25, 1] });
    glDraw(gl, { kind: "arrays", mode: "TRIANGLES", count: 3 });
}
