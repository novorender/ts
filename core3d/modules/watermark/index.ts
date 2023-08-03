import type { DerivedRenderState, RenderContext } from "core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glDraw, glState } from "webgl2";
import type { UniformTypes } from "webgl2";
// import logoBinary from "./logo.bin";

export class WatermarkModule implements RenderModule {
    readonly kind = "watermark";
    readonly uniforms = {
        modelClipMatrix: "mat4",
        color: "vec4",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new WatermarkModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const { vertexShader, fragmentShader } = context.imports.shaders.watermark.render;
        const bin = context.resourceBin("Watermark");
        const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
        const { vertices, indices } = WatermarkModule.geometry(context.imports.logo);
        const vb = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: vertices });
        const ib = bin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: indices });
        const vao = bin.createVertexArray({
            attributes: [
                { kind: "FLOAT_VEC3", buffer: vb, byteStride: 12, byteOffset: 0 }, // position
            ],
            indices: ib
        });
        bin.subordinate(vao, vb, ib);
        const program = await context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks: ["Watermark"] })
        return { bin, uniforms, vao, program } as const;
    }

    // these magic numbers are the byte offsets and lengths from gltf bufferViews
    static readonly vertexBufferBytes = 16620;
    static readonly indexBufferBytes = 12276;
    static readonly numIndices = this.indexBufferBytes / 2;

    // Logo data are comes from the binary buffer of an gltf file. It has positions and triangle indices only. Z-coordinate is used for antialiasing. Mesh has been tesselated such that each triangle lies in a single antialiasing slope, i.e. has vertices along one edge only.
    static geometry(logo: ArrayBuffer) {
        const vertices = new Float32Array(logo, 0, WatermarkModule.vertexBufferBytes / 4).slice();
        const indices = new Uint16Array(logo, WatermarkModule.vertexBufferBytes, WatermarkModule.numIndices).slice();
        return { vertices, indices };
    }
}

type Uniforms = ReturnType<WatermarkModule["createUniforms"]>;
type Resources = Awaited<ReturnType<WatermarkModule["createResources"]>>;

class WatermarkModuleContext implements RenderModuleContext {
    constructor(readonly context: RenderContext, readonly module: WatermarkModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { output } = state; 6
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
        const { context, resources, module } = this;
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
        const stats = glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: WatermarkModule.numIndices });
        context.addRenderStatistics(stats);
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}
