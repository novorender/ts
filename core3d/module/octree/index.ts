import { CoordSpace, DerivedRenderState, Matrices, RenderContext, RenderStateScene } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy } from "../uniforms";
import { mat4 } from "gl-matrix";
import { OctreeNode } from "./node";
import { createSceneRootNode } from "@novorender/core3d/scene";
import { Downloader } from "./download";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import vertexShaderDebug from "./shader_debug.vert";
import fragmentShaderDebug from "./shader_debug.frag";

export class OctreeModule implements RenderModule {
    readonly uniformsData;
    constructor(readonly initialState: DerivedRenderState) {
        this.uniformsData = createUniformBufferProxy({
            objectClipMatrix: "mat4",
        });
        updateUniforms(this.uniformsData.uniforms, initialState);
    }

    withContext(context: RenderContext) {
        return new OctreeModuleContext(context, this.uniformsData, this.initialState);
    }
}

type UniformsData = OctreeModule["uniformsData"];

interface RelevantRenderState {
    scene: RenderStateScene | undefined;
    matrices: Matrices;
}


class OctreeModuleContext implements RenderModuleContext {
    private readonly state;
    readonly program: WebGLProgram;
    readonly programDebug: WebGLProgram;
    readonly octreeUniformsBuffer: WebGLBuffer;
    readonly downloader = new Downloader();
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string = "";
    readonly projectedSizeSplitThreshold = 1; // / (settings.quality.detail.value * deviceProfile.detailBias); // baseline node size split threshold = 50% of view height

    constructor(readonly renderContext: RenderContext, readonly octreeUniformsData: UniformsData, initialState: RelevantRenderState) {
        this.state = new RenderModuleState(initialState);
        const { renderer } = renderContext;
        // create static GPU resources here
        const uniformBufferBlocks = ["Camera", "Octree"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.programDebug = renderer.createProgram({ vertexShader: vertexShaderDebug, fragmentShader: fragmentShaderDebug, uniformBufferBlocks });
        this.octreeUniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: octreeUniformsData.buffer });
    }

    render(state: DerivedRenderState) {
        const { renderContext, program, programDebug, octreeUniformsBuffer } = this;
        const { renderer, cameraUniformsBuffer } = renderContext;
        if (this.state.hasChanged(state)) {
            const { octreeUniformsData } = this;
            updateUniforms(octreeUniformsData.uniforms, state);
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: octreeUniformsData.buffer, targetBuffer: octreeUniformsBuffer });

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
            if (cameraUniformsBuffer) {
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
            }

            // split and download
            rootNode.lod(state);
        }
    }

    dispose() {
        const { renderContext, program, programDebug, octreeUniformsBuffer, rootNode } = this;
        const { renderer } = renderContext;
        rootNode?.dispose();
        this.rootNode = undefined;
        renderer.deleteBuffer(octreeUniformsBuffer);
        renderer.deleteProgram(program);
        renderer.deleteProgram(programDebug);
    }
}

function updateUniforms(uniforms: UniformsData["uniforms"], state: RelevantRenderState) {
    const { scene, matrices } = state;
    const worldClipMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.Clip);
    const objectWorldMatrix = mat4.create(); // offset/translation?
    uniforms.objectClipMatrix = mat4.mul(mat4.create(), worldClipMatrix, objectWorldMatrix);
}



/*

make cameraUniformsBuffer in RenderContext ctor
change schema such that submeshes can be any primitive type

NB: keep js memory stuff in module class, not in context class!

mvp:
/add scene url to state
/download scene root and parse
/render scene root mesh
/  no materials, no shading (normal=RGB), just triangles
transform vertices (use matrix?)

next:
traverse tree, parse and render children
  does it work on ios/ipad?!

then:
add materials and shading

finally:
add extra render targts
*/