import { CoordSpace, DerivedRenderState, Matrices, RenderContext, RenderStateScene, ViewFrustum } from "core3d";
import { RenderModuleContext, RenderModule, RenderModuleState } from "..";
import { createSceneRootNode } from "core3d/scene";
import { NodeState, OctreeNode, Visibility } from "./node";
import { Downloader } from "./download";
import { createUniformsProxy, glBuffer, glDelete, glDraw, glProgram, glState, glUniformLocations, glUpdateBuffer } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import vertexShaderDebug from "./shader_debug.vert";
import fragmentShaderDebug from "./shader_debug.frag";
import { MaterialType } from "./schema";
import { getMultiDrawParams } from "./mesh";
import { mat4 } from "gl-matrix";
import { NodeLoader } from "./loader";

export class OctreeModule implements RenderModule {
    readonly uniforms = {
        localViewMatrix: "mat4",
        // ibl params
        // sun params (+ambient)
        // headlight params
        // elevation params
        // outline params
        // clipping planes
        // materials
        // elevation colors
    } as const;

    readonly loader = new NodeLoader({ useWorker: true });

    withContext(context: RenderContext) {
        return new OctreeModuleContext(context, this);
    }
}

interface RelevantRenderState {
    scene: RenderStateScene | undefined;
    matrices: Matrices;
    viewFrustum: ViewFrustum;
}

class OctreeModuleContext implements RenderModuleContext {
    readonly state;
    readonly sceneUniforms;
    readonly resources;
    readonly textureUniformLocations;
    readonly loader: NodeLoader;
    readonly downloader = new Downloader(new URL((document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url));
    readonly debug = false;
    // Local space is a variant of world space that is occasionally offset to keep it close to camera. This helps avoid large coordinate values and float32 rounding errors in shaders.
    localSpaceChanged = false;
    readonly localWorldMatrix = mat4.create();
    readonly worldLocalMatrix = mat4.create();
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string = "";
    readonly projectedSizeSplitThreshold = 1 / 0.5; // / (settings.quality.detail.value * deviceProfile.detailBias); // baseline node size split threshold = 50% of view height

    constructor(readonly renderContext: RenderContext, readonly data: OctreeModule) {
        this.state = new RenderModuleState<RelevantRenderState>();
        this.sceneUniforms = createUniformsProxy(data.uniforms);
        this.loader = data.loader;
        const { gl } = renderContext;
        const flags = ["IOS_WORKAROUND"];
        const uniformBufferBlocks = ["Camera", "Materials", "Scene", "Node"];
        const program = glProgram(gl, { vertexShader, fragmentShader, flags, uniformBufferBlocks });
        const programZ = glProgram(gl, { vertexShader, fragmentShader, flags: [...flags, "POS_ONLY"], uniformBufferBlocks });
        const programDebug = glProgram(gl, { vertexShader: vertexShaderDebug, fragmentShader: fragmentShaderDebug, uniformBufferBlocks });
        const sceneUniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: this.sceneUniforms.buffer.byteLength });
        const materialsUniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: 256 * 4 });
        this.textureUniformLocations = glUniformLocations(gl, program, ["diffuse", "specular"] as const, "texture_ibl_");
        this.resources = { program, programZ, programDebug, sceneUniforms, materialsUniforms } as const;
    }

    update(state: DerivedRenderState) {
        const beginTime = performance.now();

        const { renderContext, resources, projectedSizeSplitThreshold, sceneUniforms } = this;
        const { gl } = renderContext;

        if (this.state.hasChanged(state)) {
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
                const materialUniformsData = this.makeMaterialUniforms(state);
                if (materialUniformsData) {
                    glUpdateBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: materialUniformsData, targetBuffer: resources.materialsUniforms });
                }
            } else if (!url) {
                this.rootNode?.dispose();
                this.rootNode = undefined;
            }
            this.url = url;

            // TODO: update local space, if needed, and if so, also update node UBOs.

            const worldViewMatrix = state.matrices.getMatrix(CoordSpace.World, CoordSpace.View);
            sceneUniforms.values.localViewMatrix = mat4.multiply(mat4.create(), worldViewMatrix, this.localWorldMatrix);
            glUpdateBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: sceneUniforms.buffer, targetBuffer: resources.sceneUniforms });
        }

        const { rootNode } = this;
        if (rootNode) {
            rootNode.update(state); // recursively update all nodes' visibility and projectedSize++

            // collapse nodes
            let nodes = [...iterateNodes(rootNode)];
            for (const node of nodes) {
                if (!node.shouldSplit(projectedSizeSplitThreshold * 0.98)) { // add a little "slack" before collapsing back again
                    if (node.state != NodeState.collapsed) {
                        node.dispose(); // collapse node
                    }
                }
            }
            nodes = [...iterateNodes(rootNode)];
            nodes.sort((a, b) => b.projectedSize - a.projectedSize); // sort by descending projected size

            const maxGPUBytes = 1_000_000_000;
            const maxPrimitives = 2_000_000;
            let gpuBytes = 0;
            let primitives = 0; // # rendered primitives (points, lines and triangles)
            for (const node of nodes) {
                if (node.hasGeometry) {
                    gpuBytes += node.data.gpuBytes;
                    primitives += node.renderedPrimitives;
                }
                if (node.state == NodeState.requestDownload) {
                    // include projected resources in the budget
                    primitives += node.data.primitivesDelta;
                    gpuBytes += node.data.gpuBytes;
                }
            }

            // split nodes based on camera orientation
            for (const node of nodes) {
                if (node.shouldSplit(projectedSizeSplitThreshold)) {
                    if (node.state == NodeState.collapsed) {
                        if (primitives + node.data.primitivesDelta <= maxPrimitives && gpuBytes + node.data.gpuBytes <= maxGPUBytes) {
                            node.state = NodeState.requestDownload;
                            primitives += node.data.primitivesDelta;
                            gpuBytes += node.data.gpuBytes;
                        }
                    }
                }
            }
            sessionStorage.setItem("gpu_bytes", gpuBytes.toLocaleString());
            sessionStorage.setItem("primitives", primitives.toLocaleString());

            const maxDownloads = 8;
            let availableDownloads = maxDownloads - this.downloader.activeDownloads;

            for (const node of nodes) {
                if (availableDownloads > 0 && node.state == NodeState.requestDownload) {
                    node.downloadGeometry();
                    availableDownloads--;
                }
            }
        }
        const endTime = performance.now();
        // console.log(endTime - beginTime);
    }

    prepass() {
        const { resources, renderContext, rootNode } = this;
        const { programZ } = resources;
        const { gl } = renderContext;
        if (rootNode) {
            let nodes = [...iterateNodes(rootNode)];
            nodes.sort((a, b) => a.viewDistance - b.viewDistance); // sort nodes front to back, i.e. ascending view distance

            glState(gl, {
                program: programZ,
                depthTest: true,
            });
            for (const node of nodes) {
                this.renderNode(node, true, true);
            }
        }
    }

    render() {
        const { resources, renderContext, rootNode, debug } = this;
        const { usePrepass } = renderContext;
        const { program, programDebug, materialsUniforms, sceneUniforms } = resources;
        const { gl, iblTextures, cameraUniforms } = renderContext;
        if (rootNode) {
            let nodes = [...iterateNodes(rootNode)];
            nodes.sort((a, b) => a.viewDistance - b.viewDistance); // sort nodes front to back, i.e. ascending view distance
            const { textureUniformLocations } = this;
            const samplerSingle = iblTextures?.samplerSingle ?? null;
            const samplerMip = iblTextures?.samplerMip ?? null;
            const diffuse = iblTextures?.diffuse ?? null;
            const specular = iblTextures?.specular ?? null;
            glState(gl, {
                program: program,
                uniformBuffers: [cameraUniforms, materialsUniforms, sceneUniforms],
                cullEnable: true,
                depthTest: true,
                depthFunc: usePrepass ? "LEQUAL" : "LESS",
                depthWriteMask: true,
                textures: [
                    { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerSingle, uniform: textureUniformLocations.specular },
                    { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerMip, uniform: textureUniformLocations.diffuse },
                ],
                // drawBuffers: ["COLOR_ATTACHMENT0", "COLOR_ATTACHMENT1", "COLOR_ATTACHMENT2", "COLOR_ATTACHMENT3"],
                drawBuffers: ["COLOR_ATTACHMENT0"],
            });
            for (const node of nodes) {
                if (node.visibility != Visibility.none) {
                    // TODO: extract meshes and sort by type so we can keep state changes to a minimum.
                    this.renderNode(node, false, !usePrepass);
                }
            }

            if (debug) {
                glState(gl, {
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
                    this.renderNodeDebug(node);
                }

                glState(gl, {
                    program: programDebug,
                    depthFunc: "LESS",
                    blendColor: [0, 0, 0, .75],
                });
                for (const node of nodes) {
                    this.renderNodeDebug(node);
                }

                glState(gl, {
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
    }

    renderNode(node: OctreeNode, prepass = false, writeZ = true) {
        const { renderContext, resources } = this;
        const { materialsUniforms, sceneUniforms } = resources;
        const { gl, cameraUniforms } = renderContext;
        const { data, renderedChildMask } = node;
        if (renderedChildMask) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, 3, node.uniforms ?? null);
            for (const mesh of node.meshes) {
                const { materialType } = mesh;
                const isTransparent = materialType == MaterialType.transparent;
                if (prepass && isTransparent)
                    continue;
                gl.bindVertexArray(prepass ? mesh.vaoPosOnly : mesh.vao);
                // const blendEnable = isTransparent;
                // glState(gl, {
                //     uniformBuffers: [cameraUniforms, materialsUniforms, sceneUniforms, node.uniforms],
                //     vertexArrayObject: prepass ? mesh.vaoPosOnly : mesh.vao,
                //     cullEnable: materialType == MaterialType.opaque,
                //     depthWriteMask: !isTransparent && writeZ,
                //     blendEnable,
                //     blendSrcRGB: blendEnable ? "SRC_ALPHA" : "ONE",
                //     blendSrcAlpha: "ZERO",
                //     blendDstRGB: blendEnable ? "ONE_MINUS_SRC_ALPHA" : "ZERO",
                //     blendDstAlpha: "ONE",
                // });
                if (renderedChildMask == data.childMask) {
                    glDraw(gl, mesh.drawParams);
                } else {
                    // determine which portions of the parent node must be rendered based on what children currently doesn't render themselves
                    const multiDrawParams = getMultiDrawParams(mesh, renderedChildMask);
                    if (multiDrawParams) {
                        glDraw(gl, multiDrawParams);
                    }
                }
            }
        }
    }

    renderNodeDebug(node: OctreeNode) {
        const { renderContext, resources } = this;
        const { materialsUniforms, sceneUniforms } = resources;
        const { gl, cameraUniforms } = renderContext;

        if (node.renderedChildMask) {
            glState(gl, {
                uniformBuffers: [cameraUniforms, sceneUniforms, materialsUniforms, node.uniforms],
            });
            glDraw(gl, { kind: "arrays", mode: "TRIANGLES", count: 8 * 12 });
        }
    }


    contextLost() {
        const { loader, downloader, rootNode } = this;
        downloader.abort();
        loader.abortAll();
        rootNode?.dispose(); // TODO: consider retaining submesh js data
    }

    dispose() {
        this.contextLost();
        glDelete(this.renderContext.gl, this.resources);
        this.rootNode = undefined;
    }

    makeMaterialUniforms(state: DerivedRenderState) {
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
            return srcData;
        }
    }
}


function* iterateNodes(node: OctreeNode): IterableIterator<OctreeNode> {
    yield node;
    for (const child of node.children) {
        yield* iterateNodes(child);
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
