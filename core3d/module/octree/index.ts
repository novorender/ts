import type { DerivedRenderState, Matrices, RenderContext, RenderStateScene } from "core3d";
import { CoordSpace } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createUniformBufferProxy, UniformsHandler } from "../../uniforms";
import { mat4 } from "gl-matrix";
import { NodeState, OctreeNode } from "./node";
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
            // ibl params
            // sun params (+ambient)
            // headlight params
            // elevation params
            // outline params
            // clipping planes
            // materials
            // elevation colors
        });
    }

    withContext(context: RenderContext) {
        return new OctreeModuleContext(context, this);
    }
}

interface RelevantRenderState {
    scene: RenderStateScene | undefined;
    matrices: Matrices;
}

class OctreeModuleContext implements RenderModuleContext {
    readonly state;
    readonly uniforms;
    readonly program: WebGLProgram;
    readonly programDebug: WebGLProgram;
    readonly materialsUniformsBuffer: WebGLBuffer;
    readonly downloader = new Downloader();
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string = "";
    readonly projectedSizeSplitThreshold = 1; // / (settings.quality.detail.value * deviceProfile.detailBias); // baseline node size split threshold = 50% of view height

    constructor(readonly renderContext: RenderContext, readonly data: OctreeModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        const { renderer } = renderContext;
        this.uniforms = new UniformsHandler(renderer, data.uniformsProxy);
        const uniformBufferBlocks = ["Camera", "Materials", "Node"];
        this.program = renderer.createProgram({ vertexShader, fragmentShader, uniformBufferBlocks });
        this.programDebug = renderer.createProgram({ vertexShader: vertexShaderDebug, fragmentShader: fragmentShaderDebug, uniformBufferBlocks });
        this.materialsUniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", size: 256 * 4 });
    }

    render(state: DerivedRenderState) {
        const { renderContext, program, programDebug, materialsUniformsBuffer, projectedSizeSplitThreshold } = this;
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
            function* iterate(node: OctreeNode): IterableIterator<OctreeNode> {
                yield node;
                for (const child of node.children) {
                    yield* iterate(child);
                }
            }
            let nodes = [...iterate(rootNode)];

            // update node visibility and projectedSize++
            for (const node of nodes) {
                node.update(state);
                if (!node.shouldSplit(projectedSizeSplitThreshold * 0.98)) { // add a little "slack" before collapsing back again
                    if (node.state != NodeState.collapsed) {
                        // collapse node
                        node.dispose();
                    }
                }
            }
            nodes = [...iterate(rootNode)];

            // sort nodes by projected size
            nodes.sort((a, b) => b.projectedSize - a.projectedSize);

            // dispose nodes that exceed limits
            const maxGPUBytes = 1_000_000_000;
            const maxTriangles = 5_000_000;
            let gpuBytes = 0;
            let triangles = 0; // # rendered triangles
            let exceeded = false;
            {
                for (const node of nodes) {
                    const { renderedTriangles } = node;
                    if (exceeded || gpuBytes + node.data.gpuBytes > maxGPUBytes || triangles + renderedTriangles > maxTriangles) {
                        if (node.hasGeometry) {
                            node.dispose();
                            exceeded = true; // for better deterministism, also dispose every subsequent node, even if some may still fit within budget, 
                        }
                    } else {
                        gpuBytes += node.data.gpuBytes;
                        triangles += renderedTriangles;
                    }
                }
                // sessionStorage.setItem("triangles", triangles.toLocaleString());
                // console.log(`Triangles: ${(triangles / 1000 / 1000).toFixed(3)} of ${(maxTriangles / 1000 / 1000).toFixed(3)}`);
                // console.log(`GPU memory (MB): ${(gpuBytes / 1024 / 1024).toFixed(3)} of ${(maxGPUBytes / 1024 / 1024).toFixed(3)}`);
            }
            nodes = [...iterate(rootNode)];

            renderer.state({
                program: program,
                depthTest: true,
                drawBuffers: ["COLOR_ATTACHMENT0", "COLOR_ATTACHMENT1", "COLOR_ATTACHMENT2", "COLOR_ATTACHMENT3"],
                // drawBuffers: ["COLOR_ATTACHMENT0"],
                // depthWriteMask: true,
                // cullEnable: false
            });
            for (const node of nodes) {
                node.render([cameraUniformsBuffer, materialsUniformsBuffer]);
            }

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
                for (const node of nodes) {
                    node.renderDebug([cameraUniformsBuffer, materialsUniformsBuffer]);
                }

                renderer.state({
                    program: programDebug,
                    depthFunc: "LESS",
                    blendColor: [0, 0, 0, .75],
                });
                for (const node of nodes) {
                    node.renderDebug([cameraUniformsBuffer, materialsUniformsBuffer]);
                }

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

            // split nodes based on camera orientation
            for (const node of nodes) {
                if (node.shouldSplit(projectedSizeSplitThreshold)) {
                    if (node.state == NodeState.collapsed) {
                        const nodeNewTriangles = node.data.primitivesDelta; // the # of new rendered primitives that would be introduced by this node compared to parent mesh.
                        if (triangles + nodeNewTriangles <= maxTriangles && gpuBytes + node.data.gpuBytes <= maxGPUBytes) {
                            // include projected resources in the budget
                            triangles += nodeNewTriangles;
                            gpuBytes += node.data.gpuBytes;
                            node.state = NodeState.requestDownload;
                        }
                    }
                }
            }
            sessionStorage.setItem("gpu_bytes", gpuBytes.toLocaleString());
            sessionStorage.setItem("triangles", triangles.toLocaleString());

            const maxDownloads = 8;
            let availableDownloads = maxDownloads - this.downloader.activeDownloads;

            for (const node of nodes) {
                // TODO: limit # active downloads
                if (availableDownloads > 0 && node.state == NodeState.requestDownload) {
                    node.downloadGeometry();
                    availableDownloads--;
                }
            }
        }
    }

    contextLost() {
        this.downloader.abort();
        this.rootNode?.dispose(); // TODO: consider retaining submesh js data
    }

    dispose() {
        const { renderContext, program, programDebug, uniforms } = this;
        const { renderer } = renderContext;
        this.contextLost();
        this.rootNode = undefined;
        renderer.deleteBuffer(this.materialsUniformsBuffer);
        uniforms.dispose();
        renderer.deleteProgram(program);
        renderer.deleteProgram(programDebug);
    }

    updateUniforms(state: DerivedRenderState) {
        const { uniforms, renderContext } = this;
        const { renderer } = renderContext;
        // uniforms.values.objectViewMatrix = mat4.mul(mat4.create(), worldViewMatrix, objectWorldMatrix);
        // uniforms.update();
        const { scene } = state;
        if (scene) {
            const { config } = scene;
            const { numMaterials } = config;
            const { diffuse, opacity } = config.materialProperties;
            console.assert(numMaterials <= 256);
            function zeroes() { return new Uint8ClampedArray(numMaterials); };
            function ones() { const a = new Uint8ClampedArray(numMaterials); a.fill(255); return a; };
            const red = decodeBase64(diffuse.red) ?? zeroes();
            const green = decodeBase64(diffuse.green) ?? zeroes();
            const blue = decodeBase64(diffuse.blue) ?? zeroes();
            const alpha = decodeBase64(opacity) ?? ones();
            const srcData = interleaveRGBA(red, green, blue, alpha);
            renderer.update({ kind: "UNIFORM_BUFFER", srcData, targetBuffer: this.materialsUniformsBuffer })
        }
    }
}

function decodeBase64(base64: string | undefined): Uint8ClampedArray | undefined {
    if (base64) {
        var binaryString = atob(base64);
        var len = binaryString.length;
        var bytes = new Uint8ClampedArray(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
}

function interleaveRGBA(r: Uint8ClampedArray, g: Uint8ClampedArray, b: Uint8ClampedArray, a: Uint8ClampedArray) {
    const n = r.length;
    console.assert(n == g.length && n == b.length && n == a.length);
    const rgba = new Uint8ClampedArray(n * 4);
    let j = 0;
    for (let i = 0; i < n; i++) {
        rgba[j++] = r[i];
        rgba[j++] = g[i];
        rgba[j++] = b[i];
        rgba[j++] = a[i];
    }
    return rgba;
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