import type { DerivedRenderState, RenderContext, RenderStateHighlightGroups, RGBATransform } from "@novorender/core3d";
import type { RenderModuleContext, RenderModule } from "..";
import { createSceneRootNode } from "@novorender/core3d/scene";
import { NodeState, type OctreeContext, OctreeNode, Visibility } from "./node";
import { glUBOProxy, glDraw, glState, glTransformFeedback, glUniformLocations, glUpdateTexture, type TextureParams2DUncompressed, type UniformTypes } from "@novorender/webgl2";
import { MaterialType } from "./schema";
import { getMultiDrawParams } from "./mesh";
import { type ReadonlyVec3, vec3 } from "gl-matrix";
import { NodeLoader, type NodeLoaderOptions } from "./loader";
import { computeGradientColors, gradientRange } from "./gradient";
// import { BufferFlags } from "@novorender/core3d/buffers";
import { shaders } from "./shaders";

export class OctreeModule implements RenderModule {
    readonly kind = "octree";
    readonly sceneUniforms = {
        applyDefaultHighlight: "bool",
        iblMipCount: "float",
        pixelSize: "float",
        maxPixelSize: "float",
        metricSize: "float",
        toleranceFactor: "float",
        deviationIndex: "int",
        deviationFactor: "float",
        deviationRange: "vec2",
        elevationRange: "vec2",
        nearOutlineColor: "vec3",
    } as const satisfies Record<string, UniformTypes>;

    readonly gradientImageParams: TextureParams2DUncompressed = { kind: "TEXTURE_2D", width: Gradient.size, height: 2, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null };
    readonly nodeLoaderOptions: NodeLoaderOptions = { useWorker: true }; // set to false for better debugging
    readonly maxHighlights = 8;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);
        return new OctreeModuleContext(context, this, uniforms, resources);
    }

    createUniforms() {
        return glUBOProxy(this.sceneUniforms);
    }

    async createResources(context: RenderContext, uniformsProxy: Uniforms) {
        const bin = context.resourceBin("Watermark");
        const sceneUniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsProxy.buffer });
        const samplerNearest = bin.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const defaultBaseColorTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: new Uint8Array([255, 255, 255, 255]) });
        const materialTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null });
        const highlightTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 256, height: 5, internalFormat: "RGBA32F", type: "FLOAT", image: null });
        const gradientsTexture = bin.createTexture(this.gradientImageParams);

        const { outline } = context.deviceProfile.features;
        const transformFeedback = bin.createTransformFeedback()!;
        let vb_line: WebGLBuffer | null = null;
        let vao_line: WebGLVertexArrayObject | null = null;
        if (outline) {
            vb_line = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: this.maxLines * 16, usage: "STATIC_DRAW" });
            vao_line = bin.createVertexArray({
                attributes: [
                    // { kind: "FLOAT_VEC2", buffer: vb_line, byteStride: 8, byteOffset: 0 }, // position
                    { kind: "FLOAT_VEC4", buffer: vb_line, byteStride: 16, byteOffset: 0, componentType: "HALF_FLOAT", divisor: 1 }, // position
                    { kind: "FLOAT", buffer: vb_line, byteStride: 16, byteOffset: 8, componentType: "FLOAT", divisor: 1 }, // opacity
                    { kind: "UNSIGNED_INT", buffer: vb_line, byteStride: 16, byteOffset: 12, componentType: "UNSIGNED_INT", divisor: 1 }, // object_id
                ],
            });
        }

        const flags: string[] = context.deviceProfile.quirks.iosShaderBug ? ["IOS_WORKAROUND"] : []; // without this flag, complex scenes crash after a few frames on older IOS and iPad devices.
        const textureNames = ["base_color", "ibl.diffuse", "ibl.specular", "materials", "highlights", "gradients"] as const;
        const textureUniforms = textureNames.map(name => `textures.${name}`);
        const uniformBufferBlocks = ["Camera", "Clipping", "Scene", "Node"];
        const [render, dither, prepass, pick, intersect, line, debug] = await Promise.all([
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms }),
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: { flags: [...flags, "DITHER"] } }),
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: { flags: [...flags, "PREPASS"] } }),
            context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: { flags: [...flags, "PICK"] } }),
            context.makeProgramAsync(bin, { ...shaders.intersect, uniformBufferBlocks, transformFeedback: { varyings: ["line_vertices", "opacity", "object_id"], bufferMode: "INTERLEAVED_ATTRIBS" } }),
            context.makeProgramAsync(bin, { ...shaders.line, uniformBufferBlocks: ["Camera", "Clipping", "Scene"] }),
            context.makeProgramAsync(bin, { ...shaders.debug, uniformBufferBlocks }),
        ]);
        const programs = { render, dither, prepass, pick, intersect, line, debug };
        return {
            bin, programs,
            transformFeedback, vb_line, vao_line,
            sceneUniforms, samplerNearest, defaultBaseColorTexture, materialTexture, highlightTexture, gradientsTexture
        } as const;
    }

    readonly maxLines = 1024 * 1024; // TODO: find a proper size!
}

type Uniforms = ReturnType<OctreeModule["createUniforms"]>;
type Resources = Awaited<ReturnType<OctreeModule["createResources"]>>;

interface RenderNode {
    readonly mask: number;
    readonly node: OctreeNode;
};

const enum Gradient { size = 1024 };
const enum UBO { camera, clipping, scene, node };

class OctreeModuleContext implements RenderModuleContext, OctreeContext {
    readonly loader: NodeLoader;
    readonly meshModeLocations;
    readonly gradientsImage = new Uint8ClampedArray(Gradient.size * 2 * 4);
    debug = false;

    localSpaceTranslation = vec3.create() as ReadonlyVec3;
    localSpaceChanged = false;
    url: string | undefined;
    rootNode: OctreeNode | undefined;
    version: string = "";
    projectedSizeSplitThreshold = 1; // baseline node size split threshold = 50% of view height

    constructor(readonly renderContext: RenderContext, readonly module: OctreeModule, readonly sceneUniforms: Uniforms, readonly resources: Resources) {
        this.loader = new NodeLoader(module.nodeLoaderOptions);
        const { gl } = renderContext;
        const { programs } = resources;
        this.meshModeLocations = {
            prepass: glUniformLocations(gl, programs.prepass, ["meshMode"]).meshMode,
            render: glUniformLocations(gl, programs.render, ["meshMode"]).meshMode,
            dither: glUniformLocations(gl, programs.dither, ["meshMode"]).meshMode,
            pick: glUniformLocations(gl, programs.pick, ["meshMode"]).meshMode,
        } as const;
    }

    update(state: DerivedRenderState) {
        // const beginTime = performance.now();

        const { renderContext, resources, sceneUniforms, projectedSizeSplitThreshold, module } = this;
        const { gl, deviceProfile } = renderContext;
        const { scene, localSpaceTranslation, highlights, points, terrain, outlines } = state;
        const { values } = sceneUniforms;

        this.projectedSizeSplitThreshold = 1 / deviceProfile.detailBias;

        if (values.iblMipCount != renderContext.iblTextures.numMipMaps) {
            values.iblMipCount = renderContext.iblTextures.numMipMaps;
        }

        this.debug = state.debug.showNodeBounds;

        let updateGradients = false;
        if (renderContext.hasStateChanged({ points })) {
            const { size, deviation } = points;
            const { values } = sceneUniforms;
            values.pixelSize = size.pixel ?? 0;
            values.maxPixelSize = size.maxPixel ?? 20;
            values.metricSize = size.metric ?? 0;
            values.toleranceFactor = size.toleranceFactor ?? 0;
            values.deviationIndex = deviation.index;
            values.deviationFactor = deviation.mixFactor;
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
            glUpdateTexture(gl, resources.gradientsTexture, { ...module.gradientImageParams, image: this.gradientsImage });
        }

        if (renderContext.hasStateChanged({ scene })) {
            const url = scene?.url;
            this.loader.init(scene); // will abort any pending downloads for previous scene
            if (url && url != this.url) {
                this.url = url;
                const { config } = scene;
                this.rootNode?.dispose();
                const { version } = scene.config;
                this.version = version;
                this.rootNode = createSceneRootNode(this, config);
                this.rootNode.downloadGeometry();
                const materialData = this.makeMaterialAtlas(state);
                if (materialData) {
                    glUpdateTexture(gl, resources.materialTexture, { kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: materialData });
                }
            } else if (!url) {
                this.url = url;
                this.rootNode?.dispose();
                this.rootNode = undefined;
            }
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

            const { maxGPUBytes } = deviceProfile.limits; // 1_000_000_000;
            const { maxPrimitives } = deviceProfile.limits; // 2_000_000;
            let gpuBytes = 0;
            let primitives = 0; // # rendered primitives (points, lines and triangles)
            for (const node of nodes) {
                if (node.hasGeometry) {
                    gpuBytes += node.data.gpuBytes;
                    primitives += node.renderedPrimitives;
                }
                if (node.state == NodeState.requestDownload || node.state == NodeState.downloading) {
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
            let availableDownloads = maxDownloads - this.loader.activeDownloads;
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

    applyDefaultAttributeValues() {
        const { gl } = this.renderContext;
        // we need to provide default values for non-float vertex attributes in case they are not included in vertex buffer to avoid getting a type binding error.
        gl.vertexAttribI4ui(VertexAttributeIds.material, 0xff, 0, 0, 0);
        gl.vertexAttribI4ui(VertexAttributeIds.objectId, 0xffffffff, 0, 0, 0);
        gl.vertexAttrib4f(VertexAttributeIds.color0, 1, 1, 1, 1);
        gl.vertexAttrib4f(VertexAttributeIds.deviations, 0, 0, 0, 0);
        gl.vertexAttribI4ui(VertexAttributeIds.highlight, 0, 0, 0, 0);
    }

    getRenderNodes(projectedSizeSplitThreshold: number): readonly RenderNode[] {
        const { rootNode } = this;
        // create list of meshes that we can sort by material/state?
        const nodes: RenderNode[] = [];
        function iterate(node: OctreeNode): boolean {
            let mask = node.data.childMask;
            let rendered = false;
            if (node.visibility != Visibility.none) {
                if (node.shouldSplit(projectedSizeSplitThreshold)) {
                    for (const child of node.children) {
                        if (child.hasGeometry) {
                            rendered = true;
                            if (iterate(child)) {
                                mask &= ~(1 << child.data.childIndex);
                            }
                        }
                    }
                } else {
                    rendered = true;
                }
                if (mask) {
                    nodes.push({ mask, node });
                }
            }
            return rendered;
        }
        if (rootNode) {
            iterate(rootNode);
        }
        nodes.sort((a, b) => a.node.viewDistance - b.node.viewDistance); // sort nodes front to back, i.e. ascending view distance
        return nodes;
    }

    prepass(state: DerivedRenderState) {
        const { resources, renderContext, rootNode } = this;
        const { programs } = resources;
        const { gl } = renderContext;
        if (rootNode) {
            // let nodes = [...iterateNodes(rootNode)];
            // nodes.sort((a, b) => a.viewDistance - b.viewDistance); // sort nodes front to back, i.e. ascending view distance
            const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail);
            glState(gl, {
                program: programs.prepass,
                depth: { test: true },
            });
            gl.activeTexture(gl.TEXTURE0);
            const meshState: MeshState = {};
            for (const { mask, node } of renderNodes) {
                this.renderNode(node, mask, meshState, "prepass");
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }

    render(state: DerivedRenderState) {
        const { resources, renderContext, rootNode, debug } = this;
        const { usePrepass, samplerSingle, samplerMip } = renderContext;
        const { programs, sceneUniforms, samplerNearest, materialTexture, highlightTexture, gradientsTexture } = resources;
        const { gl, iblTextures, cameraUniforms, clippingUniforms, deviceProfile } = renderContext;
        if (rootNode) {
            const program = state.effectiveSamplesMSAA > 1 ? "render" : "dither";
            const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail);
            const { diffuse, specular } = iblTextures;
            glState(gl, {
                program: programs[program],
                uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
                cull: { enable: true, },
                depth: {
                    test: true,
                    writeMask: true,
                    func: usePrepass ? "LEQUAL" : "LESS",
                },
                textures: [
                    { kind: "TEXTURE_2D", texture: null, sampler: samplerSingle }, // basecolor - will be overridden by nodes that have textures, e.g. terrain nodes.
                    { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerNearest },
                    { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerMip },
                    { kind: "TEXTURE_2D", texture: materialTexture, sampler: samplerNearest },
                    { kind: "TEXTURE_2D", texture: highlightTexture, sampler: samplerNearest },
                    { kind: "TEXTURE_2D", texture: gradientsTexture, sampler: samplerNearest },
                ],
            });
            this.applyDefaultAttributeValues();
            gl.activeTexture(gl.TEXTURE0);
            const meshState: MeshState = {};
            for (const { mask, node } of renderNodes) {
                this.renderNode(node, mask, meshState, program);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);

            if (state.outlines.nearClipping.enable && deviceProfile.features.outline) {
                // render clipping outlines
                glState(gl, {
                    uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
                    depth: {
                        test: false,
                        writeMask: false
                    },
                });
                for (const { mask, node } of renderNodes) {
                    if (node.intersectsPlane(state.viewFrustum.near)) {
                        this.renderNodeClippingOutline(node, mask);
                    }
                }
            }

            if (debug) {
                glState(gl, {
                    program: programs.debug,
                    depth: {
                        test: true,
                        writeMask: false,
                        func: "GREATER",
                    },
                    cull: { enable: true, },
                    blend: {
                        enable: true,
                        srcRGB: "CONSTANT_ALPHA",
                        dstRGB: "ONE_MINUS_CONSTANT_ALPHA",
                        color: [0, 0, 0, .25],
                    },
                    // drawBuffers: renderContext.drawBuffers(BufferFlags.color),
                });
                for (const { mask, node } of renderNodes) {
                    this.renderNodeDebug(node);
                }

                glState(gl, {
                    program: programs.debug,
                    depth: { func: "LESS", },
                    blend: {
                        color: [0, 0, 0, .75],
                    },
                });
                for (const { mask, node } of renderNodes) {
                    this.renderNodeDebug(node);
                }
            }
        }
    }

    pick() {
        const { resources, renderContext, rootNode } = this;
        const { gl, cameraUniforms, clippingUniforms, samplerSingle, samplerMip, iblTextures, prevState, deviceProfile } = renderContext;
        const { programs, sceneUniforms, samplerNearest, materialTexture, highlightTexture, gradientsTexture } = resources;
        const { diffuse, specular } = iblTextures;
        const state = prevState!;

        if (rootNode) {
            const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail)
            glState(gl, {
                program: programs.pick,
                uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
                cull: { enable: true, },
            });
            this.applyDefaultAttributeValues();
            gl.activeTexture(gl.TEXTURE0);
            const meshState: MeshState = {};
            for (const { mask, node } of renderNodes) {
                this.renderNode(node, mask, meshState, "pick");
            }
            gl.bindTexture(gl.TEXTURE_2D, null);

            if (state.outlines.nearClipping.enable && deviceProfile.features.outline) {
                // render clipping outlines
                glState(gl, {
                    uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
                    depth: {
                        test: false,
                        writeMask: false
                    },
                });
                for (const { mask, node } of renderNodes) {
                    if (node.intersectsPlane(state.viewFrustum.near)) {
                        this.renderNodeClippingOutline(node, mask);
                    }
                }
            }

        }
    }

    renderNode(node: OctreeNode, mask: number, meshState: MeshState, program: "prepass" | "render" | "dither" | "pick") {
        const { renderContext } = this;
        const { gl } = renderContext;
        const { resources, meshModeLocations } = this;
        const { data } = node;
        const prepass = program == "prepass";
        if (mask && node.uniforms) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO.node, node.uniforms);
            const modeMeshModeLocation = meshModeLocations[program];
            for (const mesh of node.meshes) {
                const { materialType } = mesh;
                const isTransparent = materialType == MaterialType.transparent;
                if (prepass && isTransparent)
                    continue;
                gl.bindVertexArray(prepass ? mesh.vaoPosOnly : mesh.vao);
                const mode = mesh.materialType == MaterialType.elevation ? MeshMode.elevation : mesh.drawParams.mode == "POINTS" ? MeshMode.points : MeshMode.triangles;
                if (meshState.mode != mode) {
                    meshState.mode = mode;
                    gl.uniform1ui(modeMeshModeLocation, mode);
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
                if (program = "render" || program == "dither") {
                    gl.bindTexture(gl.TEXTURE_2D, mesh.baseColorTexture ?? resources.defaultBaseColorTexture);
                }
                if (mask == data.childMask) {
                    const stats = glDraw(gl, mesh.drawParams);
                    renderContext["addRenderStatistics"](stats);
                } else {
                    // determine which portions of the parent node must be rendered based on what children currently don't render themselves
                    const multiDrawParams = getMultiDrawParams(mesh, mask);
                    if (multiDrawParams) {
                        const stats = glDraw(gl, multiDrawParams);
                        renderContext["addRenderStatistics"](stats);
                    }
                }
            }
        }
    }

    renderNodeClippingOutline(node: OctreeNode, mask: number) {
        const { resources, renderContext, module } = this;
        const { gl } = renderContext;
        const { programs, transformFeedback, vb_line, vao_line } = resources;
        if (mask && node.uniforms) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO.node, node.uniforms);
            for (const mesh of node.meshes) {
                if (mesh.numTriangles) {
                    for (const drawRange of mesh.drawRanges) {
                        if ((1 << drawRange.childIndex) & mask) {
                            const count = drawRange.count / 3;
                            const first = drawRange.first / 3;
                            console.assert(count * 2 <= module.maxLines);
                            // find triangle intersections
                            glState(gl, {
                                program: programs.intersect,
                                vertexArrayObject: mesh.vaoTriangles,
                            });
                            glTransformFeedback(gl, { kind: "POINTS", transformFeedback, outputBuffers: [vb_line!], count, first });

                            // draw lines
                            glState(gl, {
                                program: programs.line,
                                vertexArrayObject: vao_line,
                            });
                            const stats = glDraw(gl, { kind: "arrays_instanced", mode: "LINES", count: 2, instanceCount: count });
                            renderContext["addRenderStatistics"](stats);
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
            gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO.node, node.uniforms ?? null);
            const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLES", count: 8 * 12 });
            renderContext["addRenderStatistics"](stats);
        }
    }

    contextLost() {
        const { loader, rootNode } = this;
        loader.abortAll();
        rootNode?.dispose(); // consider retaining submesh js data
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
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
    deviations,
    highlight,
};

const enum MeshMode {
    triangles,
    points,
    elevation,
};

interface MeshState {
    mode?: MeshMode;
    doubleSided?: boolean;
}
