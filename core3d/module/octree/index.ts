import { CoordSpace, DerivedRenderState, Matrices, RenderContext, RenderStateScene } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy, UniformsHandler } from "../../uniforms";
import { mat4 } from "gl-matrix";
import { OctreeNode } from "./node";
import { createSceneRootNode } from "@novorender/core3d/scene";
import { Downloader } from "./download";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import vertexShaderDebug from "./shader_debug.vert";
import fragmentShaderDebug from "./shader_debug.frag";

export class OctreeModule implements RenderModule {
    readonly uniformsProxy;

    constructor() {
        this.uniformsProxy = createUniformBufferProxy({
            objectClipMatrix: "mat4",
        });
    }

    withContext(context: RenderContext) {
        return new OctreeModuleContext(context, this);
    }
}

type UniformsData = OctreeModule["uniformsProxy"];

interface RelevantRenderState {
    scene: RenderStateScene | undefined;
    matrices: Matrices;
}


class OctreeModuleContext implements RenderModuleContext {
    readonly state;
    readonly uniforms;
    readonly program: WebGLProgram;
    readonly programDebug: WebGLProgram;
    readonly downloader = new Downloader();
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string = "";
    readonly projectedSizeSplitThreshold = 1; // / (settings.quality.detail.value * deviceProfile.detailBias); // baseline node size split threshold = 50% of view height

    constructor(readonly renderContext: RenderContext, readonly data: OctreeModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        const { renderer } = renderContext;
        this.uniforms = new UniformsHandler(renderer, data.uniformsProxy);
        // create static GPU resources here
        const uniformBufferBlocks = ["Camera", "Octree"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.programDebug = renderer.createProgram({ vertexShader: vertexShaderDebug, fragmentShader: fragmentShaderDebug, uniformBufferBlocks });
    }

    render(state: DerivedRenderState) {
        const { renderContext, program, programDebug, uniforms } = this;
        const { renderer, cameraUniformsBuffer } = renderContext;
        if (this.state.hasChanged(state)) {
            this.updateUniforms(state);

            const { scene } = state;
            const url = scene?.url;
            if (url && url != this.url) {
                const { config } = scene;
                this.rootNode?.dispose();
                const { version } = scene.config;
                this.version = version;
                this.downloader.baseUrl = new URL(url);
                this.rootNode = createSceneRootNode(this, config);
                this.rootNode.downloadGeometry();
            } else if (!url) {
                this.rootNode?.dispose();
                this.rootNode = undefined;
            }
            this.url = url;
        }

        const { rootNode } = this;
        if (rootNode) {
            rootNode.update(state);
            renderer.state({
                program: program,
                depthTest: true,
                depthWriteMask: true,
                cullEnable: false
            });
            rootNode.render();

            const debug = false;
            if (debug) {
                renderer.state({
                    program: programDebug,
                    depthFunc: "GREATER",
                    depthTest: true,
                    depthWriteMask: false,
                    cullEnable: true,
                    blendEnable: true,
                    blendSrcRGB: "CONSTANT_ALPHA",
                    blendDstRGB: "ONE_MINUS_CONSTANT_ALPHA",
                    blendColor: [0, 0, 0, .25],
                });
                rootNode.renderDebug();

                renderer.state({
                    program: programDebug,
                    depthFunc: "LESS",
                    blendColor: [0, 0, 0, .75],
                });
                rootNode.renderDebug();

                renderer.state({
                    program: null,
                    depthTest: false,
                    depthWriteMask: true,
                    cullEnable: false,
                    blendEnable: false,
                    blendSrcRGB: "ONE",
                    blendDstRGB: "ZERO",
                    blendColor: [0, 0, 0, 0],
                });
            }

            // split and download
            rootNode.lod(state);
        }
    }

    contextLost() {
        this.downloader.abort();
        this.rootNode?.dispose(); // TODO: consider retaining submesh js data
    }

    dispose() {
        const { renderContext, program, programDebug, uniforms, rootNode } = this;
        const { renderer } = renderContext;
        this.contextLost();
        this.rootNode = undefined;
        uniforms.dispose();
        renderer.deleteProgram(program);
        renderer.deleteProgram(programDebug);
    }

    updateUniforms(state: DerivedRenderState) {
        const { uniforms } = this;
        const { matrices } = state;
        const worldClipMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.Clip);
        const objectWorldMatrix = mat4.create(); // offset/translation?
        uniforms.values.objectClipMatrix = mat4.mul(mat4.create(), worldClipMatrix, objectWorldMatrix);
        uniforms.update();
    }

}




/*

change schema such that submeshes can be any primitive type

NB: keep js memory stuff in module class, not in context class!

mvp:
/add scene url to state
/download scene root and parse
/render scene root mesh
/  no materials, no shading (normal=RGB), just triangles
/transform vertices (use matrix?)

next:
/traverse tree, parse and render children
/  does it work on ios/ipad?!

then:
add materials and shading

finally:
add extra render targets
*/