import type { DerivedRenderState, RenderContext } from "core3d";
import { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glBuffer, glProgram, glDraw, glState, glDelete, glVertexArray, UniformTypes } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import logoBinary from "./logo.bin";

export class WatermarkModule implements RenderModule {
    readonly uniforms = {
        modelClipMatrix: "mat4",
        color: "vec4",
    } as const satisfies Record<string, UniformTypes>;

    withContext(context: RenderContext) {
        return new WatermarkModuleContext(context, this);
    }

    // these magic numbers are the byte offsets and lengths from gltf bufferViews
    readonly vertexBufferBytes = 16620;
    readonly indexBufferBytes = 12276;
    readonly numIndices = this.indexBufferBytes / 2;

    // Logo data are comes from the binary buffer of an gltf file. It has positions and triangle indices only. Z-coordinate is used for antialiasing. Mesh has been tesselated such that each triangle lies in a single antialiasing slope, i.e. has vertices along one edge only.
    geometry() {
        const vertices = new Float32Array(logoBinary.buffer, 0, this.vertexBufferBytes / 4).slice();
        const indices = new Uint16Array(logoBinary.buffer, this.vertexBufferBytes, this.numIndices).slice();
        return { vertices, indices };
    }
}

class WatermarkModuleContext implements RenderModuleContext {
    readonly uniforms;
    readonly resources;

    constructor(readonly context: RenderContext, readonly data: WatermarkModule) {
        this.uniforms = glUBOProxy(data.uniforms);
        const { gl, commonChunk } = context;
        const { vertices, indices } = data.geometry();

        // create static GPU resources here
        const program = glProgram(gl, { vertexShader, fragmentShader, commonChunk, uniformBufferBlocks: ["Watermark"] });
        const uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: this.uniforms.buffer });
        const vb = glBuffer(gl, { kind: "ARRAY_BUFFER", srcData: vertices });
        const ib = glBuffer(gl, { kind: "ELEMENT_ARRAY_BUFFER", srcData: indices });
        const vao = glVertexArray(gl, {
            attributes: [
                { kind: "FLOAT_VEC3", buffer: vb, byteStride: 12, byteOffset: 0 }, // position
            ],
            indices: ib
        });
        gl.deleteBuffer(vb);
        gl.deleteBuffer(ib);
        this.resources = { program, uniforms, vao } as const;
    }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { output } = state;
        if (context.hasStateChanged({ output })) {
            const { values } = this.uniforms;
            const padding = 1; // % of logo height
            const size = 0.2; // in % of screen diagonal
            const { width, height } = output;
            const w = 12.717909812927246 - 0.00042313020094297826;
            const h = 0.0024876839015632868 + 1.87906813621521;
            const e = 0.1; // size of aa bevel edge in meters.
            const d = Math.hypot(w, h);
            const diag = Math.hypot(width, height) * size;
            const sx = 2 * diag / d / width;
            const sy = 2 * diag / d / height;
            const sz = diag / d * e * 0.5 / h; // use to scale z-slope (should be one pixels wide)
            const m = [
                sx, 0, 0, 0,
                0, sy, 0, 0,
                0, 0, sz, 0,
                1 - (padding) * sx, -1 + (padding) * sy, sz * 0.5, 1,
            ] as const;
            values.modelClipMatrix = m;
            values.color = [43 / 255, 46 / 255, 52 / 255, 0.5];
            context.updateUniformBuffer(resources.uniforms, this.uniforms);
        }
    }

    render() {
        const { context, resources, data } = this;
        const { program, uniforms, vao, } = resources;
        const { gl } = context;

        glState(gl, {
            program,
            uniformBuffers: [uniforms],
            depth: { writeMask: false, },
            cull: { enable: true },
            vertexArrayObject: vao,
            blend: {
                enable: true,
                srcRGB: "SRC_ALPHA",
                srcAlpha: "ONE",
                dstRGB: "ONE",
                dstAlpha: "ONE",
            },
        });
        glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: data.numIndices });
    }

    contextLost(): void {
    }

    dispose() {
        const { context, resources } = this;
        const { gl } = context;
        this.contextLost();
        glDelete(gl, resources);
    }
}
