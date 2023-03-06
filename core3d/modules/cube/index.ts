import type { DerivedRenderState, RenderContext } from "@novorender/core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glDraw, glState, glTransformFeedback, type UniformTypes } from "@novorender/webgl2";
import { mat4, vec3, type ReadonlyVec3 } from "gl-matrix";
import { BufferFlags } from "@novorender/core3d/buffers";
import { shaders } from "./shaders";

export class CubeModule implements RenderModule {
    readonly kind = "cube";
    readonly uniforms = {
        modelLocalMatrix: "mat4",
        nearOutlineColor: "vec3",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new CubeModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const vertices = createVertices((pos, norm, col) => ([...pos, ...norm, ...col]));
        const pos = createVertices((pos) => (pos));
        const indices = createIndices();
        const triplets = new Float32Array(indices.length * 3);
        for (let i = 0; i < indices.length; i += 3) {
            const [a, b, c] = indices.slice(i, i + 3);
            const pa = pos.slice(a * 3, (a + 1) * 3);
            const pb = pos.slice(b * 3, (b + 1) * 3);
            const pc = pos.slice(c * 3, (c + 1) * 3);
            triplets.set(pa, i * 3 + 0);
            triplets.set(pb, i * 3 + 3);
            triplets.set(pc, i * 3 + 6);
        }

        const bin = context.resourceBin("Cube");
        const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.buffer.byteLength });
        const transformFeedback = bin.createTransformFeedback();

        const vb_render = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: vertices });
        const ib_render = bin.createBuffer({ kind: "ELEMENT_ARRAY_BUFFER", srcData: indices });
        const vao_render = bin.createVertexArray({
            attributes: [
                { kind: "FLOAT_VEC3", buffer: vb_render, byteStride: 36, byteOffset: 0 }, // position
                { kind: "FLOAT_VEC3", buffer: vb_render, byteStride: 36, byteOffset: 12 }, // normal
                { kind: "FLOAT_VEC3", buffer: vb_render, byteStride: 36, byteOffset: 24 }, // color
            ],
            indices: ib_render
        });
        bin.subordinate(vao_render, vb_render, ib_render);

        const vb_triplets = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: triplets });
        const vao_triplets = bin.createVertexArray({
            attributes: [
                { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 0 }, // position 0
                { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 12 }, // position 1
                { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 24 }, // position 2
            ],
        });
        bin.subordinate(vao_triplets, vb_triplets);

        const vb_line = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: 12 * 2 * 8, usage: "STATIC_DRAW" });
        const vao_line = bin.createVertexArray({
            attributes: [
                { kind: "FLOAT_VEC2", buffer: vb_line, byteStride: 8, byteOffset: 0 }, // position
            ],
        });

        const uniformBufferBlocks = ["Camera", "Clipping", "Cube"];
        const [color, pick, line, intersect] = await Promise.all([
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks }),
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, header: { flags: ["PICK"] } }),
            context.makeProgramAsync(bin, { ...shaders.line, uniformBufferBlocks }),
            context.makeProgramAsync(bin, { ...shaders.intersect, uniformBufferBlocks, transformFeedback: { varyings: ["line_vertices"], bufferMode: "INTERLEAVED_ATTRIBS" } }),
        ]);
        const programs = { color, pick, line, intersect };
        return { bin, uniforms, transformFeedback, vao_render, vao_triplets, vao_line, vb_line, programs } as const;
    }
}

type Uniforms = ReturnType<CubeModule["createUniforms"]>;
type Resources = Awaited<ReturnType<CubeModule["createResources"]>>;

class CubeModuleContext implements RenderModuleContext {
    constructor(readonly context: RenderContext, readonly module: CubeModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { cube, localSpaceTranslation, outlines } = state;
        const { values } = this.uniforms;
        if (context.hasStateChanged({ cube, localSpaceTranslation })) {
            const { scale, position } = cube;
            const posLS = vec3.subtract(vec3.create(), position, localSpaceTranslation);
            const m = [
                scale, 0, 0, 0,
                0, scale, 0, 0,
                0, 0, scale, 0,
                ...posLS, 1
            ] as Parameters<typeof mat4.fromValues>;
            values.modelLocalMatrix = mat4.fromValues(...m);
        }
        if (context.hasStateChanged({ outlines })) {
            values.nearOutlineColor = outlines.nearClipping.color;
        }
        context.updateUniformBuffer(resources.uniforms, this.uniforms);
    }

    render(state: DerivedRenderState) {
        const { context, resources } = this;
        const { programs, uniforms, transformFeedback, vao_render, vao_triplets, vao_line, vb_line } = resources;
        const { gl, cameraUniforms, clippingUniforms } = context;

        if (state.cube.enabled) {
            // render normal cube
            glState(gl, {
                program: programs.color,
                uniformBuffers: [cameraUniforms, clippingUniforms, uniforms],
                // drawBuffers: context.drawBuffers(),
                depth: { test: true, },
                cull: { enable: false },
                vertexArrayObject: vao_render,
            });
            const stats = glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: 36 });
            context["addRenderStatistics"](stats);

            if (state.outlines.nearClipping.enable) {
                // transform vertex triplets into intersection lines
                glState(gl, {
                    program: programs.intersect,
                    vertexArrayObject: vao_triplets,
                });
                glTransformFeedback(gl, { kind: "POINTS", transformFeedback, outputBuffers: [vb_line], count: 12 });

                // render intersection lines
                glState(gl, {
                    program: programs.line,
                    // drawBuffers: context.drawBuffers(BufferFlags.color),
                    // blend: {
                    //     enable: true,
                    //     srcRGB: "SRC_ALPHA",
                    //     dstRGB: "ONE_MINUS_SRC_ALPHA",
                    //     srcAlpha: "ZERO",
                    //     dstAlpha: "ONE",
                    // },
                    depth: { test: false, },
                    vertexArrayObject: vao_line,
                });
                const stats = glDraw(gl, { kind: "arrays", mode: "LINES", count: 12 * 2 });
                context["addRenderStatistics"](stats);
            }
        }
    }

    pick(state: DerivedRenderState) {
        const { context, resources } = this;
        const { programs, uniforms, transformFeedback, vao_render, vao_triplets, vao_line, vb_line } = resources;
        const { gl, cameraUniforms, clippingUniforms } = context;

        if (state.cube.enabled) {
            glState(gl, {
                program: programs.pick,
                uniformBuffers: [cameraUniforms, clippingUniforms, uniforms],
                depth: { test: true, },
                cull: { enable: false },
                vertexArrayObject: vao_render,
            });
            glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: 36 });
            // TODO: render pickable outlines too?
        }
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}

function createVertices(pack: (position: ReadonlyVec3, normal: ReadonlyVec3, color: ReadonlyVec3) => Iterable<number>) {
    function face(x: ReadonlyVec3, y: ReadonlyVec3, color: ReadonlyVec3) {
        const normal = vec3.cross(vec3.create(), y, x);
        function vert(fx: "add" | "sub", fy: "add" | "sub") {
            const pos = vec3.clone(normal);
            vec3[fx](pos, pos, x);
            vec3[fy](pos, pos, y);
            return pack(pos, normal, color);
            // return [...pos, ...normal, ...color];
        }
        return [
            ...vert("sub", "sub"),
            ...vert("add", "sub"),
            ...vert("sub", "add"),
            ...vert("add", "add"),
        ];
    }

    return new Float32Array([
        ...face([0, 0, -1], [0, 1, 0], [1, 0, 0]), // right (1, 0, 0)
        ...face([0, 0, 1], [0, 1, 0], [0, 1, 1]), // left (-1, 0, 0)
        ...face([1, 0, 0], [0, 0, 1], [0, 1, 0]), // top (0, 1, 0)
        ...face([1, 0, 0], [0, 0, -1], [1, 0, 1]), // bottom (0, -1, 0)
        ...face([1, 0, 0], [0, 1, 0], [0, 0, 1]), // front (0, 0, 1)
        ...face([-1, 0, 0], [0, 1, 0], [1, 1, 0]), // back (0, 0, -1)
    ]);
}

function createIndices() {
    let idxOffset = 0;
    function face() {
        const idx = [0, 2, 1, 1, 2, 3].map(i => i + idxOffset);
        idxOffset += 4;
        return idx;
    }
    return new Uint16Array([
        ...face(),
        ...face(),
        ...face(),
        ...face(),
        ...face(),
        ...face(),
    ]);
}