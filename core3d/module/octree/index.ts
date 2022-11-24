import { DerivedRenderState, RenderContext, RenderStateScene } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy } from "../uniforms";
import { CoordSpace, Matrices } from "core3d/matrices";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import { mat4 } from "gl-matrix";
import { OctreeNode } from "./node";
import { createSceneRootNode } from "@novorender/core3d/scene";
import { Downloader } from "./download";

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
    readonly octreeUniformsBuffer: WebGLBuffer;
    readonly downloader = new Downloader();
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string | undefined;

    constructor(readonly context: RenderContext, readonly octreeUniformsData: UniformsData, initialState: RelevantRenderState) {
        this.state = new RenderModuleState(initialState);
        const { renderer } = context;
        // create static GPU resources here
        const uniformBufferBlocks = ["Camera", "Octree"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.octreeUniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: octreeUniformsData.buffer });
    }

    render(state: DerivedRenderState) {
        const { context, program, octreeUniformsBuffer } = this;
        const { renderer, cameraUniformsBuffer } = context;
        if (this.state.hasChanged(state)) {
            const { octreeUniformsData } = this;
            updateUniforms(octreeUniformsData.uniforms, state);
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: octreeUniformsData.buffer, targetBuffer: octreeUniformsBuffer });

            const url = state.scene?.url;
            if (url && url != this.url) {
                this.rootNode?.dispose();
                const { version } = state.scene.config;
                this.version = version;
                this.rootNode = createSceneRootNode(context, state.scene.config);
                this.downloader.baseUrl = new URL(url);
                this.downloadNode(this.rootNode, state.scene.config.rootByteSize);
                // TODO: add download so we can cancel?
            } else if (!url) {
                this.rootNode?.dispose();
                this.rootNode = undefined;
            }
            this.url = url;
        }

        const { rootNode } = this;
        if (rootNode && cameraUniformsBuffer) {
            rootNode.update(state);
            renderer.state({ program });
            rootNode.render(cameraUniformsBuffer);
        }
    }

    dispose() {
        const { context, program, octreeUniformsBuffer, rootNode } = this;
        const { renderer } = context;
        rootNode?.dispose();
        this.rootNode = undefined;
        renderer.deleteProgram(program);
        renderer.deleteBuffer(octreeUniformsBuffer);
    }

    async downloadNode(node: OctreeNode, byteSize: number) {
        try {
            const { context } = this;
            const download = this.downloader.downloadArrayBufferAbortable("root", new ArrayBuffer(byteSize));
            node.beginDownload(download)
            const buffer = await download.result;
            if (buffer) {
                node.endDownload(this.version!, buffer);
                context.changed = true;
            }
        } catch (error: any) {
            if (error.name != "AbortError") {
                console.error(error);
            } else {
                console.info(`abort ${node.id}`);
            }
        }
    }
}

function updateUniforms(uniforms: UniformsData["uniforms"], state: RelevantRenderState) {
    const { scene, matrices } = state;
    const worldClipMatrix = matrices.getMatrix(CoordSpace.World, CoordSpace.Clip);
    const objectWorldMatrix = mat4.create(); // offset/translation?
    uniforms.objectClipMatrix = mat4.mul(mat4.create(), worldClipMatrix, objectWorldMatrix);
}



/*
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