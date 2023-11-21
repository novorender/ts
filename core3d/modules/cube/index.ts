import type { DerivedRenderState, RenderContext } from "core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glDraw, glState, glTransformFeedback, type UniformTypes } from "webgl2";
import { mat4, vec3, vec4 } from "gl-matrix";
import { axisVertices, createIndices, createTriplets, createVertices } from "./common";

/** @internal */
export class CubeModule implements RenderModule {
    readonly kind = "cube";
    readonly cubeUniforms = {
        modelLocalMatrix: "mat4",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new CubeModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return {
            cube: glUBOProxy(this.cubeUniforms),
        } as const;
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const shaders = context.imports.shaders.cube;
        const vertices = createVertices((pos, norm, col) => ([...pos, ...norm, ...col]));
        const pos = createVertices((pos) => (pos));
        const indices = createIndices();
        const triplets = createTriplets(pos, indices);

        const bin = context.resourceBin("Cube");
        const uniforms = {
            cube: bin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: uniformsProxy.cube.buffer.byteLength }),
        } as const;
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

        const vb_axis = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: axisVertices() });
        const vao_axis = bin.createVertexArray({
            attributes: [
                { kind: "FLOAT_VEC3", buffer: vb_axis, byteStride: 36, byteOffset: 0 }, // position
                { kind: "FLOAT_VEC3", buffer: vb_axis, byteStride: 36, byteOffset: 12 }, // normal
                { kind: "FLOAT_VEC3", buffer: vb_axis, byteStride: 36, byteOffset: 24 }, // color
            ]
        });
        bin.subordinate(vao_axis, vb_axis);

        const vb_triplets = bin.createBuffer({ kind: "ARRAY_BUFFER", srcData: triplets });
        const vao_triplets = bin.createVertexArray({
            attributes: [
                { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 0 }, // position 0
                { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 12 }, // position 1
                { kind: "FLOAT_VEC3", buffer: vb_triplets, byteStride: 36, byteOffset: 24 }, // position 2
            ],
        });
        bin.subordinate(vao_triplets, vb_triplets);

        // const vb_line = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: 12 * 2 * 8, usage: "STATIC_DRAW" });
        const vb_line = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: 12 * 2 * 4, usage: "STATIC_DRAW" });
        const vb_opacity = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: 12 * 4, usage: "STATIC_DRAW" });
        const vao_line = bin.createVertexArray({
            attributes: [
                // { kind: "FLOAT_VEC2", buffer: vb_line, byteStride: 8, byteOffset: 0 }, // position
                // { kind: "FLOAT_VEC2", buffer: vb_line, byteStride: 4, byteOffset: 0, componentType: "HALF_FLOAT" }, // position
                { kind: "FLOAT_VEC4", buffer: vb_line, byteStride: 8, byteOffset: 0, componentType: "HALF_FLOAT", divisor: 1 }, // position
                { kind: "FLOAT", buffer: vb_opacity, byteStride: 4, byteOffset: 0, componentType: "FLOAT", divisor: 1 }, // opacity
            ],
        });

        const uniformBufferBlocks = ["Camera", "Clipping", "Cube"];
        const [color, pick, line, intersect] = await Promise.all([
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks }),
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, header: { flags: ["PICK"] } }),
            context.makeProgramAsync(bin, { ...shaders.line, uniformBufferBlocks: [...uniformBufferBlocks, "Outline"] }),
            context.makeProgramAsync(bin, { ...shaders.intersect, uniformBufferBlocks: [...uniformBufferBlocks, "Outline"], transformFeedback: { varyings: ["line_vertices", "opacity"], bufferMode: "SEPARATE_ATTRIBS" } }),
        ]);
        const programs = { color, pick, line, intersect };
        return { bin, uniforms, transformFeedback, vao_render, vao_triplets, vao_line, vao_axis, vb_line, vb_opacity, vb_axis, programs } as const;
    }
}

type Uniforms = ReturnType<CubeModule["createUniforms"]>;
type Resources = Awaited<ReturnType<CubeModule["createResources"]>>;

class CubeModuleContext implements RenderModuleContext {
    constructor(readonly context: RenderContext, readonly module: CubeModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    update(state: DerivedRenderState) {
        const { context, resources, uniforms } = this;
        const { cube, localSpaceTranslation } = state;
        if (context.hasStateChanged({ cube, localSpaceTranslation })) {
            const { scale, position } = cube;
            const posLS = vec3.subtract(vec3.create(), position, localSpaceTranslation);
            const m = [
                scale, 0, 0, 0,
                0, scale, 0, 0,
                0, 0, scale, 0,
                ...posLS, 1
            ] as Parameters<typeof mat4.fromValues>;
            uniforms.cube.values.modelLocalMatrix = mat4.fromValues(...m);
        }
        context.updateUniformBuffer(resources.uniforms.cube, uniforms.cube);
    }

    render(state: DerivedRenderState) {
        const { context, resources } = this;
        const { programs, uniforms, transformFeedback, vao_render, vao_triplets, vao_line, vao_axis, vb_line, vb_opacity } = resources;
        const { gl, cameraUniforms, clippingUniforms, outlineUniforms, deviceProfile } = context;

        if (state.cube.enabled) {
            // render normal cube
            if(state.cube.drawCube) {
                glState(gl, {
                    program: programs.color,
                    uniformBuffers: [cameraUniforms, clippingUniforms, uniforms.cube],
                    // drawBuffers: context.drawBuffers(),
                    depth: { test: true, },
                    cull: { enable: false },
                    vertexArrayObject: vao_render,
                });
                let stats = glDraw(gl, { kind: "elements", mode: "TRIANGLES", indexType: "UNSIGNED_SHORT", count: 36 });
                context.addRenderStatistics(stats);
            }

            // render axis
            if(state.cube.drawAxis) {
                glState(gl, {
                    program: programs.color,
                    uniformBuffers: [cameraUniforms, clippingUniforms, uniforms.cube],
                    depth: { test: true, },
                    cull: { enable: false },
                    vertexArrayObject: vao_axis,
                });
                let stats = glDraw(gl, { kind: "arrays", mode: "LINES", count: 6 });
                context.addRenderStatistics(stats);
            }

            if (state.outlines.enabled && deviceProfile.features.outline) {
                const planeIndex = state.clipping.planes.findIndex((cp) => vec4.exactEquals(cp.normalOffset, plane));
                const [x, y, z, offset] = state.outlines.plane;
                const plane = vec4.fromValues(x, y, z, -offset);

                context.updateOutlinesUniforms(plane, state.outlines.color, planeIndex);
                // transform vertex triplets into intersection lines
                glState(gl, {
                    program: programs.intersect,
                    uniformBuffers: [cameraUniforms, clippingUniforms, uniforms.cube, outlineUniforms],
                    vertexArrayObject: vao_triplets,
                });
                glTransformFeedback(gl, { kind: "POINTS", transformFeedback, outputBuffers: [vb_line, vb_opacity], count: 12 });

                // render intersection lines
                glState(gl, {
                    program: programs.line,
                    // drawBuffers: context.drawBuffers(BufferFlags.color),
                    blend: {
                        enable: true,
                        srcRGB: "SRC_ALPHA",
                        dstRGB: "ONE_MINUS_SRC_ALPHA",
                        srcAlpha: "ZERO",
                        dstAlpha: "ONE",
                    },
                    depth: { test: false, },
                    vertexArrayObject: vao_line,
                });
                // const stats = glDraw(gl, { kind: "arrays", mode: "LINES", count: 12 * 2 });
                const stats = glDraw(gl, { kind: "arrays_instanced", mode: "LINES", count: 2, instanceCount: 12 });
                context.addRenderStatistics(stats);
            }
        }
    }

    pick(state: DerivedRenderState) {
        const { context, resources } = this;
        const { programs, uniforms, vao_render } = resources;
        const { gl, cameraUniforms, clippingUniforms } = context;

        if (state.cube.enabled) {
            glState(gl, {
                program: programs.pick,
                uniformBuffers: [cameraUniforms, clippingUniforms, uniforms.cube],
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