import { DerivedRenderState, RenderContext, RenderStateHighlightGroup } from "core3d";
import { RenderModuleContext, RenderModule } from "..";
import { createSceneRootNode } from "core3d/scene";
import { NodeState, OctreeContext, OctreeNode, Visibility } from "./node";
import { Downloader } from "./download";
import { glDelete, glDraw, glProgram, glSampler, glState, glTexture, glUniformLocations, glUpdateTexture } from "webgl2";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import vertexShaderDebug from "./shader_debug.vert";
import fragmentShaderDebug from "./shader_debug.frag";
import { MaterialType } from "./schema";
import { getMultiDrawParams } from "./mesh";
import { ReadonlyVec3, vec3 } from "gl-matrix";
import { NodeLoader } from "./loader";

export class OctreeModule implements RenderModule {
    readonly loader = new NodeLoader({ useWorker: false });
    readonly maxHighlights = 8;

    withContext(context: RenderContext) {
        return new OctreeModuleContext(context, this);
    }
}

class OctreeModuleContext implements RenderModuleContext, OctreeContext {
    readonly resources;
    readonly textureUniformLocations;
    readonly loader: NodeLoader;
    readonly downloader = new Downloader(new URL((document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url));
    readonly debug = false;
    localSpaceTranslation = vec3.create() as ReadonlyVec3;
    localSpaceChanged = false;
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string = "";
    readonly projectedSizeSplitThreshold = 1 / 0.5; // / (settings.quality.detail.value * deviceProfile.detailBias); // baseline node size split threshold = 50% of view height

    constructor(readonly renderContext: RenderContext, readonly data: OctreeModule) {
        this.loader = data.loader;
        const { gl } = renderContext;
        const flags = ["IOS_WORKAROUND"];
        const uniformBufferBlocks = ["Camera", "Node"];
        const program = glProgram(gl, { vertexShader, fragmentShader, flags, uniformBufferBlocks });
        const programZ = glProgram(gl, { vertexShader, fragmentShader, flags: [...flags, "POS_ONLY"], uniformBufferBlocks });
        const programDebug = glProgram(gl, { vertexShader: vertexShaderDebug, fragmentShader: fragmentShaderDebug, uniformBufferBlocks });
        const samplerNearest = glSampler(gl, { minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const materialTexture = glTexture(gl, { kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null }); // using a texture is faster than a uniform buffer on safari
        const highlightTexture = glTexture(gl, { kind: "TEXTURE_2D", width: 256, height: 5, internalFormat: "RGBA32F", type: "FLOAT", image: null }); // using a texture is faster than a uniform buffer on safari
        this.textureUniformLocations = glUniformLocations(gl, program, ["ibl_diffuse", "ibl_specular", "base_color", "materials", "highlights"] as const, "texture_");
        this.resources = { program, programZ, programDebug, samplerNearest, materialTexture, highlightTexture } as const;
    }

    update(state: DerivedRenderState) {
        const beginTime = performance.now();

        const { renderContext, resources, projectedSizeSplitThreshold } = this;
        const { gl } = renderContext;
        const { scene, matrices, viewFrustum, highlights } = state;

        if (renderContext.hasStateChanged({ scene, matrices, viewFrustum })) {
            this.localSpaceChanged = state.localSpaceTranslation !== this.localSpaceTranslation;
            this.localSpaceTranslation = state.localSpaceTranslation;
            const url = scene?.url;
            if (url && url != this.url) {
                const { config } = scene;
                this.rootNode?.dispose();
                const { version } = scene.config;
                this.version = version;
                this.downloader.baseUrl = new URL(url);
                this.rootNode = createSceneRootNode(this, config);
                this.rootNode.downloadGeometry();
                const materialData = this.makeMaterialUniforms(state);
                if (materialData) {
                    glUpdateTexture(gl, resources.materialTexture, { kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: materialData });
                }
            } else if (!url) {
                this.rootNode?.dispose();
                this.rootNode = undefined;
            }
            this.url = url;
        }

        if (renderContext.hasStateChanged({ highlights })) {
            const { groups } = highlights;
            const transforms = groups.map(g => g.rgbaTransform);
            const prevTransforms = renderContext.prevState?.highlights.groups.map(g => g.rgbaTransform) ?? [];
            if (!sequenceEqual(transforms, prevTransforms)) {
                // update highlight matrices
                const image = createColorTransforms(groups);
                glUpdateTexture(gl, resources.highlightTexture, { kind: "TEXTURE_2D", width: 256, height: 5, internalFormat: "RGBA32F", type: "FLOAT", image });
            }
            const objectIds = groups.map(g => g.objectIds);
            const prevObjectIds = renderContext.prevState?.highlights.groups.map(g => g.objectIds) ?? [];
            if (!sequenceEqual(objectIds, prevObjectIds)) {
                // update highlight vertex attributes
                for (const node of iterateNodes(this.rootNode)) {
                    node.applyHighlightGroups(groups);
                }
            }
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
            gl.activeTexture(gl.TEXTURE0);
            for (const node of nodes) {
                this.renderNode(node, true, true);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }

    render() {
        const { resources, renderContext, rootNode, debug } = this;
        const { usePrepass, samplerSingle, samplerMip } = renderContext;
        const { program, programDebug, samplerNearest, materialTexture, highlightTexture } = resources;
        const { gl, iblTextures, cameraUniforms } = renderContext;
        if (rootNode) {
            let nodes = [...iterateNodes(rootNode)];
            nodes.sort((a, b) => a.viewDistance - b.viewDistance); // sort nodes front to back, i.e. ascending view distance
            const { textureUniformLocations } = this;
            const { diffuse, specular } = iblTextures;
            glState(gl, {
                program: program,
                uniformBuffers: [cameraUniforms],
                cullEnable: true,
                depthTest: true,
                depthFunc: usePrepass ? "LEQUAL" : "LESS",
                depthWriteMask: true,
                textures: [
                    { kind: "TEXTURE_2D", texture: null, sampler: samplerSingle, uniform: textureUniformLocations.base_color },
                    { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerSingle, uniform: textureUniformLocations.ibl_specular },
                    { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerMip, uniform: textureUniformLocations.ibl_diffuse },
                    { kind: "TEXTURE_2D", texture: materialTexture, sampler: samplerNearest, uniform: textureUniformLocations.materials },
                    { kind: "TEXTURE_2D", texture: highlightTexture, sampler: samplerNearest, uniform: textureUniformLocations.highlights },
                ],
                drawBuffers: ["COLOR_ATTACHMENT0", "COLOR_ATTACHMENT1", "COLOR_ATTACHMENT2", "COLOR_ATTACHMENT3"],
                // drawBuffers: ["COLOR_ATTACHMENT0"],
            });
            gl.activeTexture(gl.TEXTURE0);
            // we need to provide default values for non-float vertex attributes in case they are not included in vertex buffer to avoid getting a type binding error.
            gl.vertexAttribI4ui(2, 0xff, 0, 0, 0); // material_index
            gl.vertexAttribI4ui(3, 0xffffffff, 0, 0, 0); // object_id
            gl.vertexAttribI4ui(5, 0, 0, 0, 0); // highlight_index
            for (const node of nodes) {
                if (node.visibility != Visibility.none) {
                    // TODO: extract meshes and sort by type so we can keep state changes to a minimum.
                    this.renderNode(node, false, !usePrepass);
                }
            }
            gl.bindTexture(gl.TEXTURE_2D, null);

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
        const { gl } = this.renderContext;
        const { data, renderedChildMask } = node;
        if (renderedChildMask) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, node.uniforms ?? null);
            for (const mesh of node.meshes) {
                const { materialType } = mesh;
                const isTransparent = materialType == MaterialType.transparent;
                if (prepass && isTransparent)
                    continue;
                gl.bindVertexArray(prepass ? mesh.vaoPosOnly : mesh.vao);
                gl.depthMask(writeZ);
                gl.bindTexture(gl.TEXTURE_2D, mesh.baseColorTexture);
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
        const { gl, cameraUniforms } = renderContext;

        if (node.renderedChildMask) {
            glState(gl, {
                uniformBuffers: [cameraUniforms, node.uniforms],
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


function* iterateNodes(node: OctreeNode | undefined): IterableIterator<OctreeNode> {
    if (node) {
        yield node;
        for (const child of node.children) {
            yield* iterateNodes(child);
        }
    }
}

function createColorTransforms(groups: readonly RenderStateHighlightGroup[]) {
    const numColorMatrices = 256;
    const numColorMatrixCols = 5;
    const numColorMatrixRows = 4;

    const colorMatrices = new Float32Array(numColorMatrices * numColorMatrixRows * numColorMatrixCols);
    // initialize with identity matrices
    for (let i = 0; i < numColorMatrices; i++) {
        for (let j = 0; j < numColorMatrixCols; j++) {
            colorMatrices[(numColorMatrices * j + i) * 4 + j] = 1;
        }
    }

    // Copy transformation matrices
    for (let i = 0; i < groups.length; i++) {
        const { rgbaTransform } = groups[i];
        for (let col = 0; col < numColorMatrixCols; col++) {
            for (let row = 0; row < numColorMatrixRows; row++) {
                colorMatrices[(numColorMatrices * col + i) * 4 + row] = rgbaTransform[col + row * numColorMatrixCols];
            }
        }
    }
    return colorMatrices;
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
    const rgba = new Uint8ClampedArray(256 * 4);
    let j = 0;
    for (let i = 0; i < n; i++) {
        rgba[j++] = r[i];
        rgba[j++] = g[i];
        rgba[j++] = b[i];
        rgba[j++] = a[i];
    }
    return rgba;
}

function sequenceEqual(a: any[], b: any[]) {
    if (a.length != b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] != b[i]) {
            return false;
        }
    }
    return true;
}
