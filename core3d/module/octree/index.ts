import { DerivedRenderState, RenderContext, RenderStateHighlightGroups, RGBATransform } from "core3d";
import { RenderModuleContext, RenderModule } from "..";
import { createSceneRootNode } from "core3d/scene";
import { NodeState, OctreeContext, OctreeNode, Visibility } from "./node";
import { Downloader } from "./download";
import { createUniformsProxy, glBuffer, glDelete, glDraw, glProgram, glSampler, glState, glTexture, glTransformFeedback, glUpdateTexture, glVertexArray, TextureParams2DUncompressed, UniformTypes } from "webgl2";
import { MaterialType } from "./schema";
import { getMultiDrawParams } from "./mesh";
import { ReadonlyVec3, vec3 } from "gl-matrix";
import { NodeLoader, NodeLoaderOptions } from "./loader";
import { computeGradientColors, gradientRange } from "./gradient";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import line_vs from "./line.vert";
import line_fs from "./line.frag";
import intersect_vs from "./intersect.vert";
import vertexShaderDebug from "./shader_debug.vert";
import fragmentShaderDebug from "./shader_debug.frag";
import { BufferFlags } from "@novorender/core3d/buffers";

export class OctreeModule implements RenderModule {
    readonly sceneUniforms = {
        applyDefaultHighlight: "bool",
        iblMipCount: "float",
        pixelSize: "float",
        maxPixelSize: "float",
        metricSize: "float",
        toleranceFactor: "float",
        deviationMode: "uint",
        deviationRange: "vec2",
        elevationRange: "vec2",
        nearOutlineColor: "vec3",
    } as const satisfies Record<string, UniformTypes>;

    readonly meshUniforms = {
        mode: "uint",
    } as const satisfies Record<string, UniformTypes>;

    readonly gradientImageParams: TextureParams2DUncompressed = { kind: "TEXTURE_2D", width: Gradient.size, height: 2, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null };
    readonly nodeLoaderOptions: NodeLoaderOptions = { useWorker: true };
    readonly maxHighlights = 8;

    withContext(context: RenderContext) {
        return new OctreeModuleContext(context, this);
    }
}

const enum Gradient { size = 1024 };

class OctreeModuleContext implements RenderModuleContext, OctreeContext {
    readonly sceneUniforms;
    readonly resources;
    readonly loader: NodeLoader;
    readonly downloader = new Downloader(new URL((document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url));
    readonly gradientsImage = new Uint8ClampedArray(Gradient.size * 2 * 4);
    readonly debug = false;
    private readonly maxLines = 1024 * 1024; // TODO: find a proper size!

    localSpaceTranslation = vec3.create() as ReadonlyVec3;
    localSpaceChanged = false;
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string = "";
    readonly projectedSizeSplitThreshold = 1; // / (settings.quality.detail.value * deviceProfile.detailBias); // baseline node size split threshold = 50% of view height

    constructor(readonly renderContext: RenderContext, readonly data: OctreeModule) {
        this.sceneUniforms = createUniformsProxy(data.sceneUniforms);
        const meshUniforms = createUniformsProxy(data.meshUniforms);
        this.loader = new NodeLoader(data.nodeLoaderOptions);
        const { gl, commonChunk } = renderContext;
        const flags: string[] = ["IOS_WORKAROUND"]; // without this flag, complex scenes crash after a few frames on older IOS and iPad devices.
        const textureNames = ["base_color", "ibl.diffuse", "ibl.specular", "materials", "highlights", "gradients"] as const;
        const textureUniforms = textureNames.map(name => `textures.${name}`);
        const uniformBufferBlocks = ["Camera", "Scene", "Node", "Mesh"];
        const program = glProgram(gl, { vertexShader, fragmentShader, commonChunk, uniformBufferBlocks, textureUniforms, flags });
        const programZ = glProgram(gl, { vertexShader, fragmentShader, commonChunk, uniformBufferBlocks, textureUniforms, flags: [...flags, "POS_ONLY"] });
        const programIntersect = glProgram(gl, { vertexShader: intersect_vs, commonChunk, uniformBufferBlocks: ["Camera", "Scene", "Node"], transformFeedback: { varyings: ["line_vertices"], bufferMode: "INTERLEAVED_ATTRIBS" } });
        const programLine = glProgram(gl, { vertexShader: line_vs, fragmentShader: line_fs, commonChunk, uniformBufferBlocks: ["Camera", "Scene"] });
        const programDebug = this.debug ? glProgram(gl, { vertexShader: vertexShaderDebug, fragmentShader: fragmentShaderDebug, commonChunk, uniformBufferBlocks }) : null;
        const transformFeedback = gl.createTransformFeedback()!;
        const vb_line = glBuffer(gl, { kind: "ARRAY_BUFFER", size: this.maxLines * 2 * 8, usage: "STATIC_DRAW" });
        const vao_line = glVertexArray(gl, {
            attributes: [
                { kind: "FLOAT_VEC2", buffer: vb_line, stride: 8, offset: 0 }, // position
            ],
        });
        const sceneUniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: this.sceneUniforms.buffer.byteLength });
        meshUniforms.values.mode = 0;
        const meshUniforms0 = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: meshUniforms.buffer });
        meshUniforms.values.mode = 1;
        const meshUniforms1 = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: meshUniforms.buffer });
        meshUniforms.values.mode = 2;
        const meshUniforms2 = glBuffer(gl, { kind: "UNIFORM_BUFFER", srcData: meshUniforms.buffer });
        const samplerNearest = glSampler(gl, { minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const defaultBaseColorTexture = glTexture(gl, { kind: "TEXTURE_2D", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: new Uint8Array([255, 255, 255, 255]) });
        const materialTexture = glTexture(gl, { kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null });
        const highlightTexture = glTexture(gl, { kind: "TEXTURE_2D", width: 256, height: 5, internalFormat: "RGBA32F", type: "FLOAT", image: null });
        const gradientsTexture = glTexture(gl, data.gradientImageParams);
        this.resources = {
            program, programZ, programIntersect, programLine, programDebug,
            transformFeedback, vb_line, vao_line,
            sceneUniforms, meshUniforms0, meshUniforms1, meshUniforms2, samplerNearest, defaultBaseColorTexture, materialTexture, highlightTexture, gradientsTexture
        } as const;
    }

    update(state: DerivedRenderState) {
        const beginTime = performance.now();

        const { renderContext, resources, sceneUniforms, projectedSizeSplitThreshold, data } = this;
        const { gl } = renderContext;
        const { scene, localSpaceTranslation, highlights, points, terrain, outlines } = state;
        const { values } = sceneUniforms;

        if (values.iblMipCount != renderContext.iblTextures.numMipMaps) {
            values.iblMipCount = renderContext.iblTextures.numMipMaps;
        }

        let updateGradients = false;
        if (renderContext.hasStateChanged({ points })) {
            const { size, deviation } = points;
            let deviationMode = 0;
            switch (deviation.mode) {
                case "on": deviationMode = 1; break;
                case "mix": deviationMode = 2; break;
            }
            const { values } = sceneUniforms;
            values.pixelSize = size.pixel ?? 0;
            values.maxPixelSize = size.maxPixel ?? 20;
            values.metricSize = size.metric ?? 0;
            values.toleranceFactor = size.toleranceFactor ?? 0;
            values.deviationMode = deviationMode;
            values.deviationRange = gradientRange(deviation.colorGradient);
            const deviationColors = computeGradientColors(Gradient.size, deviation.colorGradient);
            this.gradientsImage.set(deviationColors, 0 * Gradient.size * 4);
            updateGradients = true;
        }

        if (renderContext.hasStateChanged({ terrain })) {
            const { values } = sceneUniforms;
            values.elevationRange = gradientRange(terrain.elevationGradient);
            const elevationColors = computeGradientColors(Gradient.size, terrain.elevationGradient);
            this.gradientsImage.set(elevationColors, 1 * Gradient.size * 4);
            updateGradients = true;
        }

        if (updateGradients) {
            glUpdateTexture(gl, resources.gradientsTexture, { ...data.gradientImageParams, image: this.gradientsImage });
        }

        if (renderContext.hasStateChanged({ scene })) {
            const url = scene?.url;
            this.loader.init(scene); // will abort any pending downloads for previous scene
            if (url && url != this.url) {
                const { config } = scene;
                this.rootNode?.dispose();
                const { version } = scene.config;
                this.version = version;
                this.downloader.baseUrl = new URL(url);
                this.rootNode = createSceneRootNode(this, config);
                this.rootNode.downloadGeometry();
                const materialData = this.makeMaterialAtlas(state);
                if (materialData) {
                    glUpdateTexture(gl, resources.materialTexture, { kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: materialData });
                }
            } else if (!url) {
                this.rootNode?.dispose();
                this.rootNode = undefined;
            }
            this.url = url;
        }

        if (renderContext.hasStateChanged({ outlines })) {
            const { values } = sceneUniforms;
            values.nearOutlineColor = outlines.nearClipping.color;
        }

        if (renderContext.hasStateChanged({ localSpaceTranslation })) {
            this.localSpaceChanged = localSpaceTranslation !== this.localSpaceTranslation;
            this.localSpaceTranslation = localSpaceTranslation;
        }

        if (renderContext.hasStateChanged({ highlights })) {
            const { groups } = highlights;
            const transforms = [highlights.defaultHighlight, ...groups.map(g => g.rgbaTransform)];
            const prevTransforms = renderContext.prevState ?
                [
                    renderContext.prevState.highlights.defaultHighlight,
                    ...renderContext.prevState.highlights.groups.map(g => g.rgbaTransform)
                ] : [];
            if (!sequenceEqual(transforms, prevTransforms)) {
                // update highlight matrices
                const image = createColorTransforms(highlights);
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
            const { values } = sceneUniforms;
            values.applyDefaultHighlight = highlights.defaultHighlight != undefined;
        }
        renderContext.updateUniformBuffer(resources.sceneUniforms, sceneUniforms);

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
            const meshState: MeshState = {};
            for (const node of nodes) {
                this.renderNode(node, meshState, true, true);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }

    render(state: DerivedRenderState) {
        const { resources, renderContext, rootNode, debug } = this;
        const { usePrepass, samplerSingle, samplerMip } = renderContext;
        const { program, programDebug, sceneUniforms, samplerNearest, materialTexture, highlightTexture, gradientsTexture } = resources;
        const { gl, iblTextures, cameraUniforms } = renderContext;
        if (rootNode) {
            let nodes = [...iterateNodes(rootNode)];
            nodes.sort((a, b) => a.viewDistance - b.viewDistance); // sort nodes front to back, i.e. ascending view distance

            const { diffuse, specular } = iblTextures;
            glState(gl, {
                program: program,
                uniformBuffers: [cameraUniforms, sceneUniforms, null, resources.meshUniforms0],
                cullEnable: true,
                depthTest: true,
                depthFunc: usePrepass ? "LEQUAL" : "LESS",
                depthWriteMask: true,
                textures: [
                    { kind: "TEXTURE_2D", texture: null, sampler: samplerSingle }, // basecolor - will be overridden by nodes that have textures, e.g. terrain nodes.
                    { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerSingle },
                    { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerMip },
                    { kind: "TEXTURE_2D", texture: materialTexture, sampler: samplerNearest },
                    { kind: "TEXTURE_2D", texture: highlightTexture, sampler: samplerNearest },
                    { kind: "TEXTURE_2D", texture: gradientsTexture, sampler: samplerNearest },
                ],
                drawBuffers: renderContext.drawBuffers(BufferFlags.all),
                // drawBuffers: renderContext.drawBuffers(BufferFlags.color),
            });
            gl.activeTexture(gl.TEXTURE0);
            // we need to provide default values for non-float vertex attributes in case they are not included in vertex buffer to avoid getting a type binding error.
            gl.vertexAttribI4ui(VertexAttributeIds.material, 0xff, 0, 0, 0); // material_index
            gl.vertexAttribI4ui(VertexAttributeIds.objectId, 0xffffffff, 0, 0, 0); // object_id
            gl.vertexAttribI4ui(VertexAttributeIds.highlight, 0, 0, 0, 0); // highlight_index
            const meshState: MeshState = {};
            for (const node of nodes) {
                if (node.visibility != Visibility.none) {
                    // TODO: extract meshes and sort by type so we can keep state changes to a minimum.
                    this.renderNode(node, meshState, false, !usePrepass);
                }
            }
            gl.bindTexture(gl.TEXTURE_2D, null);

            if (state.outlines.nearClipping.enable) {
                // render clipping outlines
                glState(gl, {
                    uniformBuffers: [cameraUniforms, sceneUniforms, null],
                    depthTest: false,
                    depthWriteMask: false,
                    drawBuffers: renderContext.drawBuffers(BufferFlags.color),
                });
                for (const node of nodes) {
                    if (node.visibility != Visibility.none && node.intersectsPlane(state.viewFrustum.near)) {
                        this.renderNodeClippingOutline(node);
                    }
                }
            }

            if (debug) {
                glState(gl, {
                    program: programDebug,
                    uniformBuffers: [cameraUniforms, sceneUniforms],
                    depthFunc: "GREATER",
                    depthTest: true,
                    depthWriteMask: false,
                    cullEnable: true,
                    blendEnable: true,
                    blendSrcRGB: "CONSTANT_ALPHA",
                    blendDstRGB: "ONE_MINUS_CONSTANT_ALPHA",
                    blendColor: [0, 0, 0, .25],
                    drawBuffers: renderContext.drawBuffers(BufferFlags.color),
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

    renderNode(node: OctreeNode, meshState: MeshState, prepass = false, writeZ = true) {
        const { gl } = this.renderContext;
        const { resources } = this;
        const { data, renderedChildMask } = node;
        const { values } = node.uniformsData;
        if (renderedChildMask && node.uniforms) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, node.uniforms);
            for (const mesh of node.meshes) {
                const { materialType } = mesh;
                const isTransparent = materialType == MaterialType.transparent;
                if (prepass && isTransparent)
                    continue;
                gl.bindVertexArray(prepass ? mesh.vaoPosOnly : mesh.vao);
                gl.depthMask(writeZ);
                const mode = mesh.materialType == MaterialType.elevation ? 2 : mesh.drawParams.mode == "POINTS" ? 1 : 0;
                if (meshState.mode != mode) {
                    meshState.mode = mode;
                    // TODO: use regular uniform instead.
                    gl.bindBufferBase(gl.UNIFORM_BUFFER, 3, mode == 0 ? resources.meshUniforms0 : mode == 1 ? resources.meshUniforms1 : resources.meshUniforms2);
                }
                const doubleSided = mesh.materialType != MaterialType.opaque;
                if (meshState.doubleSided != doubleSided) {
                    meshState.doubleSided = doubleSided;
                    if (doubleSided) {
                        gl.disable(gl.CULL_FACE);
                    } else {
                        gl.enable(gl.CULL_FACE);
                    }
                }
                gl.bindTexture(gl.TEXTURE_2D, mesh.baseColorTexture ?? resources.defaultBaseColorTexture);
                if (renderedChildMask == data.childMask) {
                    glDraw(gl, mesh.drawParams);
                } else {
                    // determine which portions of the parent node must be rendered based on what children currently don't render themselves
                    const multiDrawParams = getMultiDrawParams(mesh, renderedChildMask);
                    if (multiDrawParams) {
                        glDraw(gl, multiDrawParams);
                    }
                }
            }
        }
    }

    renderNodeClippingOutline(node: OctreeNode) {
        const { gl } = this.renderContext;
        const { resources } = this;
        const { programIntersect, programLine, transformFeedback, vb_line, vao_line } = resources;
        const { renderedChildMask } = node;
        if (renderedChildMask && node.uniforms) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, node.uniforms);
            for (const mesh of node.meshes) {
                if (mesh.numTriplets) {
                    for (const drawRange of mesh.drawRanges) {
                        if ((1 << drawRange.childIndex) & renderedChildMask) {
                            const count = drawRange.count / 3;
                            const first = drawRange.first / 3;
                            console.assert(count * 2 <= this.maxLines);
                            // find triangle intersections
                            glState(gl, {
                                program: programIntersect,
                                vertexArrayObject: mesh.vaoTriplets,
                            });
                            glTransformFeedback(gl, { kind: "POINTS", transformFeedback, outputBuffers: [vb_line], count, first });

                            // draw lines
                            glState(gl, {
                                program: programLine,
                                vertexArrayObject: vao_line,
                            });
                            glDraw(gl, { kind: "arrays", mode: "LINES", count: count * 2, first: 0 });
                        }
                    }
                }
            }
        }
    }


    renderNodeDebug(node: OctreeNode) {
        const { renderContext } = this;
        const { gl } = renderContext;

        if (node.renderedChildMask && node.uniforms) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, 2, node.uniforms ?? null);
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

    makeMaterialAtlas(state: DerivedRenderState) {
        const { scene } = state;
        if (scene) {
            const { config } = scene;
            const { numMaterials } = config;
            if (numMaterials) {
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
}


function* iterateNodes(node: OctreeNode | undefined): IterableIterator<OctreeNode> {
    if (node) {
        yield node;
        for (const child of node.children) {
            yield* iterateNodes(child);
        }
    }
}

function createColorTransforms(highlights: RenderStateHighlightGroups) {
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

    function copyMatrix(index: number, rgbaTransform: RGBATransform) {
        for (let col = 0; col < numColorMatrixCols; col++) {
            for (let row = 0; row < numColorMatrixRows; row++) {
                colorMatrices[(numColorMatrices * col + index) * 4 + row] = rgbaTransform[col + row * numColorMatrixCols];
            }
        }
    }

    // Copy transformation matrices
    const { defaultHighlight, groups } = highlights;
    copyMatrix(0, defaultHighlight);
    for (let i = 0; i < groups.length; i++) {
        copyMatrix(i + 1, groups[i].rgbaTransform);
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

const enum VertexAttributeIds {
    position,
    normal,
    material,
    objectId,
    texCoord0,
    color0,
    deviation,
    highlight,
};

const enum MeshMode {
    triangles,
    points,
};

interface MeshState {
    mode?: MeshMode;
    doubleSided?: boolean;
}
