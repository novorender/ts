import type { WebGL2Renderer } from "@novorender/webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

export async function hello_triangle(renderer: WebGL2Renderer) {
    const { width, height } = renderer.canvas;
    const program = renderer.createProgram({ vertexShader, fragmentShader });
    const vb = renderer.createBuffer({ kind: "ARRAY_BUFFER", srcData: new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]) });
    const vao = renderer.createVertexArray({ attributes: [{ kind: "FLOAT_VEC2", buffer: vb }] });

    renderer.state({
        viewport: { width, height },
        program,
        vertexArrayObject: vao,
    });

    renderer.clear({ kind: "back_buffer", color: [0, 0, .25, 1] });
    renderer.draw({ kind: "arrays", mode: "TRIANGLES", count: 3 });
}
