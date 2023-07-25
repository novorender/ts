import type { DerivedRenderState, RenderContext } from "core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { glUBOProxy, glDraw, glState, type UniformTypes } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat4, vec3 } from "gl-matrix";

export class GridModule implements RenderModule {
    readonly kind = "grid";
    readonly uniforms = {
        origin: "vec3",
        axisX: "vec3",
        axisY: "vec3",
        size1: "float",
        size2: "float",
        color1: "vec3",
        color2: "vec3",
        distance: "float",
    } as const satisfies Record<string, UniformTypes>;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new GridModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.uniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const bin = context.resourceBin("Grid");
        const uniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
        const program = await context.makeProgramAsync(bin, { vertexShader, fragmentShader, uniformBufferBlocks: ["Camera", "Grid"] })
        return { bin, uniforms, program } as const;
    }
}

type Uniforms = ReturnType<GridModule["createUniforms"]>;
type Resources = Awaited<ReturnType<GridModule["createResources"]>>;

class GridModuleContext implements RenderModuleContext {
    constructor(readonly context: RenderContext, readonly module: GridModule, readonly uniforms: Uniforms, readonly resources: Resources) { }

    update(state: DerivedRenderState) {
        const { context, resources } = this;
        const { uniforms } = resources;
        const { grid, localSpaceTranslation } = state;
        if (context.hasStateChanged({ grid, localSpaceTranslation })) {
            const { values } = this.uniforms;
            const { axisX, axisY, origin } = grid;
            const worldLocalMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), localSpaceTranslation));
            values.origin = vec3.transformMat4(vec3.create(), origin, worldLocalMatrix);
            values.axisX = axisX;
            values.axisY = axisY;
            values.color1 = grid.color1;
            values.color2 = grid.color2;
            values.size1 = grid.size1;
            values.size2 = grid.size2;
            values.distance = grid.distance;
            context.updateUniformBuffer(uniforms, this.uniforms);
        }
    }

    render(state: DerivedRenderState) {
        const { context, resources } = this;
        const { program, uniforms } = resources;
        const { gl, cameraUniforms } = context;

        if (state.grid.enabled) {
            glState(gl, {
                program,
                uniformBuffers: [cameraUniforms, uniforms],
                depth: {
                    test: true,
                    writeMask: false,
                },
                sample: {
                    alphaToCoverage: false
                },
                blend: {
                    enable: true,
                    srcRGB: "SRC_ALPHA",
                    dstRGB: "ONE_MINUS_SRC_ALPHA",
                    srcAlpha: "ZERO",
                    dstAlpha: "ONE",
                },
            });
            const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLE_STRIP", count: 4 });
            context.addRenderStatistics(stats);
        }
    }

    contextLost(): void {
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
    }
}