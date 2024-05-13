import { createPBRMaterial, type ActiveTexturesArray, type DerivedRenderState, type MaxActiveTextures, type RenderContext, type RenderStateGroupAction, type RenderStateHighlightGroups, type RenderStateHighlightGroupTexture, type RenderStateScene, type RGB, type RGBATransform, type ActiveTextureIndex, type PBRMaterialTextures } from "core3d";
import type { RenderModuleContext } from "..";
import { createSceneRootNodes } from "core3d/scene";
import { NodeState, type OctreeContext, OctreeNode, Visibility, NodeGeometryKind } from "./node";
import { glClear, glDelete, glDraw, glState, glUpdateTexture, type TextureUpdateParams2DArrayUncompressed, type UncompressedTextureFormatType } from "webgl2";
import { getMultiDrawParams, MaterialType } from "./mesh";
import { type ReadonlyVec3, vec3, vec4, type ReadonlyVec4, glMatrix } from "gl-matrix";
import type { NodeLoader } from "./loader";
import { computeGradientColors, gradientRange } from "./gradient";
// import { BufferFlags } from "@novorender/core3d/buffers";
import { OctreeModule, Gradient, type Resources, type Uniforms, ShaderMode, ShaderPass, type MaterialTextures } from "./module";
import { Mutex } from "./mutex";
import { decodeBase64 } from "core3d/util";
import { OutlineRenderer } from "./outlines";

const enum UBO { camera, clipping, scene, node };

export interface RenderNode {
    readonly mask: number;
    readonly node: OctreeNode;
};

/** @internal */
export interface RootNodes {
    readonly [NodeGeometryKind.terrain]?: OctreeNode;
    readonly [NodeGeometryKind.triangles]?: OctreeNode;
    readonly [NodeGeometryKind.lines]?: OctreeNode;
    readonly [NodeGeometryKind.points]?: OctreeNode;
    readonly [NodeGeometryKind.documents]?: OctreeNode;
}

/** @internal */
export class OctreeModuleContext implements RenderModuleContext, OctreeContext {
    readonly gradientsImage = new Uint8ClampedArray(Gradient.size * 2 * 4);
    currentProgramFlags = OctreeModule.defaultProgramFlags;
    nextProgramFlags = OctreeModule.defaultProgramFlags;
    debug = false;
    suspendUpdates = false;

    materialTextures: MaterialTextures = { color: null, nor: null };
    currentActiveTextures: ActiveTexturesArray | undefined;
    readonly textureValid: boolean[] = [false, false, false, false, false, false, false, false, false, false];

    localSpaceTranslation = vec3.create() as ReadonlyVec3;
    localSpaceChanged = false;
    url: string | undefined;
    // rootNode: OctreeNode | undefined;
    rootNodes: RootNodes = {};
    version: string = "";
    projectedSizeSplitThreshold = 1; // baseline node size split threshold = 50% of view height
    hidden = [false, false, false, false, false] as readonly [boolean, boolean, boolean, boolean, boolean];
    readonly highlight;
    highlightGeneration = 0;
    private compiling = false;

    constructor(readonly renderContext: RenderContext, readonly module: OctreeModule, readonly uniforms: Uniforms, readonly resources: Resources, buffer: SharedArrayBuffer, readonly loader: NodeLoader) {
        this.highlight = {
            buffer,
            indices: new Uint8Array(buffer, 4),
            mutex: new Mutex(buffer),
        } as const;
    }

    get highlights() {
        return this.highlight.indices;
    }

    update(state: DerivedRenderState) {
        // const beginTime = performance.now();

        const { renderContext, resources, uniforms, projectedSizeSplitThreshold, module, currentProgramFlags } = this;
        const { gl, deviceProfile } = renderContext;
        const { scene, localSpaceTranslation, highlights, points, terrain, pick, output, clipping, outlines } = state;
        const { values } = uniforms.scene;

        let { nextProgramFlags } = this;
        const updateShaderCompileConstants = (flags: Partial<typeof nextProgramFlags>) => {
            type Keys = keyof typeof nextProgramFlags;
            if ((Object.getOwnPropertyNames(flags) as Keys[]).some(key => nextProgramFlags[key] != flags[key])) {
                this.nextProgramFlags = nextProgramFlags = { ...nextProgramFlags, ...flags };
            }
        }

        this.projectedSizeSplitThreshold = 1 / deviceProfile.detailBias;

        if (values.iblMipCount != renderContext.iblTextures.numMipMaps) {
            values.iblMipCount = renderContext.iblTextures.numMipMaps;
        }

        this.debug = state.debug.showNodeBounds;

        let updateGradients = false;
        if (renderContext.hasStateChanged({ points })) {
            const { size, deviation } = points;
            const { values } = uniforms.scene;
            values.pixelSize = size.pixel ?? 0;
            values.maxPixelSize = size.maxPixel ?? 20;
            values.metricSize = size.metric ?? 0;
            values.toleranceFactor = size.toleranceFactor ?? 0;
            values.deviationIndex = deviation.index;
            values.deviationFactor = deviation.mixFactor;
            values.deviationUndefinedColor = deviation.undefinedColor ?? vec4.fromValues(0, 0, 0, 0);
            values.deviationRange = gradientRange(deviation.colorGradient);
            values.useProjectedPosition = points.useProjectedPosition;
            const deviationColors = computeGradientColors(Gradient.size, deviation.colorGradient);
            this.gradientsImage.set(deviationColors, 0 * Gradient.size * 4);
            updateGradients = true;
        }


        if (renderContext.hasStateChanged({ terrain })) {
            const { values } = uniforms.scene;
            values.elevationRange = gradientRange(terrain.elevationGradient);
            const elevationColors = computeGradientColors(Gradient.size, terrain.elevationGradient);
            this.gradientsImage.set(elevationColors, 1 * Gradient.size * 4);
            updateGradients = true;
        }

        if (renderContext.hasStateChanged({ pick })) {
            const { values } = uniforms.scene;
            values.pickOpacityThreshold = pick.opacityThreshold;
        }

        if (outlines && renderContext.prevState?.outlines && outlines.breakingPointAngleThreshold != renderContext.prevState.outlines.breakingPointAngleThreshold) {
            renderContext.outlineRenderers = new WeakMap<ReadonlyVec4, OutlineRenderer>; // all outline renderers has to go
        }

        if (updateGradients) {
            glUpdateTexture(gl, resources.gradientsTexture, { ...module.gradientImageParams, image: this.gradientsImage });
        }

        if (renderContext.hasStateChanged({ scene })) {
            const { prevState } = renderContext;
            if (scene) {
                const { hide } = scene;
                if (hide != prevState?.scene?.hide) {
                    if (hide) {
                        const { terrain, triangles, lines, points, documents } = hide;
                        this.hidden = [terrain ?? false, triangles ?? false, lines ?? false, points ?? false, documents ?? false];
                    } else {
                        this.hidden = [true, false, false, false, false];
                    }
                }
            }

            if (scene?.url != this.url) {
                if (this.url) {
                    this.loader.abortAll(); // abort any pending downloads for previous scene
                }

                // delete existing scene
                this.disposeRootNodes();
                
                // update material atlas if url has changed
                const url = scene?.url;
                if (url != this.url) {
                    const { highlight } = this;
                    const numObjects = scene?.config.numObjects ?? 0;
                    const numBytes = numObjects + 4; // add four bytes for mutex
                    if (highlight.buffer.byteLength != numBytes) {
                        highlight.mutex.lockSpin();
                        if (numBytes > highlight.buffer.byteLength) {
                            //@ts-ignore
                            highlight.buffer.grow(numBytes);
                        }
                        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
                        (highlight as Mutable<typeof highlight>).indices = new Uint8Array(highlight.buffer, 4, numObjects);
                        updateHighlightBuffer(highlight.indices, state.highlights);
                        this.highlightGeneration++;
                        highlight.mutex.unlock();
                    }
                    this.url = url;
                    if (url) {
                        const materialData = makeMaterialAtlas(state);
                        if (materialData) {
                            glUpdateTexture(gl, resources.materialTexture, { kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "SRGB8_ALPHA8", type: "UNSIGNED_BYTE", image: materialData });
                        }
                    }
                }

                // initiate loading of scene
                if (scene) {
                    this.version = scene.config.version;
                    this.reloadScene(scene);
                }
            }
        }

        const { rootNodes } = this;

        if (renderContext.hasStateChanged({ localSpaceTranslation })) {
            this.localSpaceChanged = localSpaceTranslation !== this.localSpaceTranslation;
            this.localSpaceTranslation = localSpaceTranslation;
            renderContext.outlineRenderers = new WeakMap<ReadonlyVec4, OutlineRenderer>; // all outline renderers has to go
        }

        if (renderContext.hasStateChanged({ highlights })) {
            const { groups } = highlights;
            const { highlight } = this;
            const { prevState } = renderContext;
            const prevGroups = prevState?.highlights.groups ?? [];

            updateShaderCompileConstants({ highlight: groups.length > 0 || highlights.defaultAction != undefined });

            const { values } = uniforms.scene;
            values.applyDefaultHighlight = highlights.defaultAction != undefined;

            const objectIds = groups.map(g => g.objectIds);
            const prevObjectIds = prevState?.highlights.groups.map(g => g.objectIds) ?? [];
            const objectIdsChanged = !sequenceEqual(objectIds, prevObjectIds);

            // are there any potential changes to filtering ?
            if (scene) {
                let reload = false;
                const prevDefaultAction = prevState?.highlights.defaultAction;
                const currDefaultAction = state.highlights.defaultAction;
                if (prevDefaultAction != currDefaultAction && (prevDefaultAction == "filter" || currDefaultAction == "filter")) {
                    reload = true; // default action has changed from/to filter mode.
                } else if (currDefaultAction == "filter" && objectIdsChanged) {
                    const numUnfilteredObjIds = groups.filter(g => g.action != "filter").map(g => "length" in g.objectIds ? g.objectIds.length as number : 0).reduce((a, b) => (a + b));
                    const maxIds = 1_000_000;
                    if (numUnfilteredObjIds < maxIds) {
                        const unfilteredGroupsPrev = new Set<number>(prevGroups.filter(g => g.action != "filter").flatMap(g => [...g.objectIds]));
                        const unfilteredGroupsCurr = new Set<number>(groups.filter(g => g.action != "filter").flatMap(g => [...g.objectIds]));

                        if (unfilteredGroupsPrev.size != unfilteredGroupsCurr.size) {
                            reload = true;
                        }
                        if (!reload) {
                            if ("isSubsetOf" in unfilteredGroupsPrev && "isSubsetOf" in unfilteredGroupsCurr) {
                                const areEqual = (unfilteredGroupsPrev as any).isSubsetOf(unfilteredGroupsCurr) && (unfilteredGroupsCurr as any).isSubsetOf(unfilteredGroupsPrev);
                                if (!areEqual) {
                                    reload = true;
                                }
                            } else {
                                for (const objId of unfilteredGroupsPrev) {
                                    if (!unfilteredGroupsCurr.has(objId)) {
                                        reload = true;
                                        break;
                                    }
                                }
                                if (!reload) {
                                    for (const objId of unfilteredGroupsCurr) {
                                        if (!unfilteredGroupsPrev.has(objId)) {
                                            reload = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        reload = true;
                    }
                } else {
                    const filterGroups = new Set<Iterable<number>>(prevGroups.filter(g => g.action == "filter").map(g => g.objectIds));
                    for (const { action, objectIds } of groups) {
                        if (action == "filter") {
                            var removed = filterGroups.delete(objectIds);
                            if (!removed) {
                                reload = true; // one of the groups has changed to filter mode.
                                break;
                            }
                        }
                    }
                    if (filterGroups.size > 0) {
                        reload = true; // At least one of the groups has changed from filter mode.
                    }
                }
                if (reload) {
                    this.reloadScene(scene);
                }
            }

            const transforms = [highlights.defaultAction, ...groups.map(g => g.action)];
            const prevTransforms = prevState ?
                [
                    prevState.highlights.defaultAction,
                    ...prevState.highlights.groups.map(g => g.action)
                ] : [];
            if (!sequenceEqual(transforms, prevTransforms)) {
                this.updateHighlightTexture(highlights);
            }

            const actions = groups.map(g => typeof g.action == "string" ? g.action : undefined);
            const prevActions = prevState?.highlights.groups.map(g => typeof g.action == "string" ? g.action : undefined) ?? [];
            const actionsChanged = highlights.defaultAction != prevState?.highlights.defaultAction || !sequenceEqual(actions, prevActions);

            if (objectIdsChanged || actionsChanged) {
                highlight.mutex.lockSpin(); // worker should not hold this lock for long, so we're fine spinning until it's available.
                updateHighlightBuffer(highlight.indices, highlights);
                this.highlightGeneration++;
                highlight.mutex.unlock();
                // update highlight vertex attributes
                const nodes: OctreeNode[] = [];
                for (const rootNode of Object.values(rootNodes)) {
                    nodes.push(...iterateNodes(rootNode));
                }
                for (const node of nodes) {
                    node.applyHighlights(highlight.indices);
                }
            };

            // textures
            if (renderContext.materialCommon && highlights.textures != renderContext.prevState?.highlights.textures) {
                if (highlights.textures) {
                    const maxTextures: MaxActiveTextures = 10;
                    updateShaderCompileConstants({ pbr: true });
                    if (!this.materialTextures.color) {
                        this.materialTextures = OctreeModule.createMaterialTextureArrays(resources.bin, renderContext.materialCommon, maxTextures);
                    }

                    // update texture array slices, as needed
                    const newTextures = highlights.textures;
                    const prevTextures = renderContext.prevState?.highlights.textures ?? [];
                    const loadTextures: LoadTextureParams[] = [];
                    for (let i = 0; i < maxTextures; i++) {
                        if (newTextures[i] && newTextures[i] != prevTextures[i]) {
                            const index = i as ActiveTextureIndex;
                            const { url } = newTextures[i]!;
                            loadTextures.push({ index, source: new URL(url) });
                        }
                    }
                    this.loadMaterialTextures(loadTextures);
                } else {
                    if (this.materialTextures.color) {
                        OctreeModule.disposeMaterialTextures(this.resources.bin, this.materialTextures);
                        this.materialTextures = { color: null, nor: null };
                    }
                    updateShaderCompileConstants({ pbr: false });
                }
            }
        }

        if (renderContext.hasStateChanged({ clipping })) {
            updateShaderCompileConstants({ clippingPlanes: clipping.enabled ? clipping.planes.length : 0 });
        }

        if (renderContext.hasStateChanged({ output })) {
            updateShaderCompileConstants({ dither: output.samplesMSAA <= 1 });
        }

        renderContext.updateUniformBuffer(resources.sceneUniforms, uniforms.scene);

        // recompile shader programs if flags have changed
        if (currentProgramFlags != nextProgramFlags && !this.compiling) {
            this.compiling = true;
            const recompile = async () => {
                const programs = await OctreeModule.compileShaders(renderContext, resources.bin, nextProgramFlags);
                Object.assign(resources.programs, programs);
                renderContext.changed = true;
                this.compiling = false;
                this.currentProgramFlags = nextProgramFlags;
            }
            recompile();
        }

        if (!this.suspendUpdates) {
            const nodes: OctreeNode[] = [];
            for (const rootNode of Object.values(rootNodes)) {
                rootNode.update(state); // recursively update all nodes' visibility and projectedSize++

                // collapse nodes
                const preCollapseNodes = [...iterateNodes(rootNode)];
                for (const node of preCollapseNodes) {
                    if (!node.shouldSplit(projectedSizeSplitThreshold * 0.98)) { // add a little "slack" before collapsing back again
                        if (node.state != NodeState.collapsed) {
                            node.dispose(); // collapse node
                        }
                    }
                }
                nodes.push(...iterateNodes(rootNode));
            }

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

            renderContext.addLoadStatistics(primitives);

            const maxDownloads = 8;
            let availableDownloads = maxDownloads - this.loader.activeDownloads;
            for (const node of nodes) {
                if (availableDownloads > 0 && node.state == NodeState.requestDownload) {
                    node.downloadNode();
                    availableDownloads--;
                }
            }
        }
    }

    applyDefaultAttributeValues() {
        const { gl } = this.renderContext;
        // we need to provide default values for non-float vertex attributes in case they are not included in vertex buffer to avoid getting a type binding error.
        gl.vertexAttribI4ui(VertexAttributeIds.material, 0xff, 0, 0, 0);
        gl.vertexAttribI4ui(VertexAttributeIds.objectId, 0xffffffff, 0, 0, 0);
        gl.vertexAttrib4f(VertexAttributeIds.color0, 0, 0, 0, 0); // we don't really use vertex color for anything else than point clouds. We set this to 0 differentiate between textured and elevation-gradient terrain, since the latter will override color in vertex shader.
        gl.vertexAttrib4f(VertexAttributeIds.projectedPos, 0, 0, 0, 0);
        gl.vertexAttrib4f(VertexAttributeIds.deviations, 0, 0, 0, 0);
        gl.vertexAttribI4ui(VertexAttributeIds.highlight, 0, 0, 0, 0);
    }

    getRenderNodes(projectedSizeSplitThreshold: number, ...rootNodes: readonly (OctreeNode | undefined)[]): readonly RenderNode[] {
        // create list of meshes that we can sort by material/state?
        const nodes: RenderNode[] = [];
        function iterate(node: OctreeNode): boolean {
            let rendered = false;
            if (node.visibility != Visibility.none && node.hasGeometry) {
                let mask = node.data.childMask;
                if (node.shouldSplit(projectedSizeSplitThreshold)) {
                    for (const child of node.children) {
                        if (iterate(child)) {
                            mask &= ~(1 << child.data.childIndex);
                        }
                    }
                }
                rendered = true;
                if (mask || node.data.childMask == 0) {
                    nodes.push({ mask, node });
                }
            }
            return rendered;
        }
        for (const rootNode of rootNodes) {
            if (rootNode) {
                iterate(rootNode);
            }
        }

        nodes.sort((a, b) => a.node.viewDistance - b.node.viewDistance); // sort nodes front to back, i.e. ascending view distance
        return nodes;
    }

    prepass(state: DerivedRenderState) {
        const { resources, renderContext } = this;
        const { programs } = resources;
        const { gl } = renderContext;
        for (const rootNode of Object.values(this.rootNodes)) {
            const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
            glState(gl, {
                program: programs.pre,
                depth: { test: true },
            });
            gl.activeTexture(gl.TEXTURE0);
            const meshState: MeshState = {};
            for (const { mask, node } of renderNodes) {
                this.renderNode(node, mask, meshState, ShaderPass.pre);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
    }

    render(state: DerivedRenderState) {
        const { resources, renderContext, debug } = this;
        const { usePrepass, samplerSingle, samplerMip, samplerEnvMip, samplerMipRepeat } = renderContext;
        const { color, nor } = this.materialTextures;
        const { programs, sceneUniforms, samplerNearest, materialTexture, highlightTexture, gradientsTexture } = resources;
        const { gl, iblTextures, lut_ggx, cameraUniforms, clippingUniforms, deviceProfile } = renderContext;

        // glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });

        const { diffuse, specular } = iblTextures;
        glState(gl, {
            program: programs.color,
            uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
            cull: { enable: true, },
            depth: {
                test: true,
                writeMask: true,
                func: usePrepass ? "LEQUAL" : "LESS",
            },
            textures: [
                { kind: "TEXTURE_2D", texture: null, sampler: samplerSingle }, // unlit_color - will be overridden by nodes that have textures, e.g. terrain nodes.
                { kind: "TEXTURE_CUBE_MAP", texture: diffuse, sampler: samplerSingle },
                { kind: "TEXTURE_CUBE_MAP", texture: specular, sampler: samplerEnvMip },
                { kind: "TEXTURE_2D", texture: materialTexture, sampler: samplerNearest },
                { kind: "TEXTURE_2D", texture: highlightTexture, sampler: samplerNearest },
                { kind: "TEXTURE_2D", texture: gradientsTexture, sampler: samplerNearest },
                { kind: "TEXTURE_2D", texture: lut_ggx, sampler: samplerMip },
                { kind: "TEXTURE_2D_ARRAY", texture: color, sampler: samplerMipRepeat }, // material textures: base_color
                { kind: "TEXTURE_2D_ARRAY", texture: nor, sampler: samplerMipRepeat }, // material textures: normal, occlusion & roughness map
            ],
        });
        this.applyDefaultAttributeValues();
        gl.activeTexture(gl.TEXTURE0);

        for (const rootNode of Object.values(this.rootNodes)) {
            const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
            const meshState: MeshState = {};
            for (const { mask, node } of renderNodes) {
                this.renderNode(node, mask, meshState, ShaderPass.color);
            }
            if (rootNode.geometryKind == NodeGeometryKind.terrain && state.terrain.asBackground) {
                glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
            }
        }

        gl.bindTexture(gl.TEXTURE_2D, null);

        if (deviceProfile.features.outline && state.outlines.on) {
            const renderOutlines = (plane: ReadonlyVec4, color: RGB, planeIndex = -1) => {
                const [x, y, z, offset] = plane;
                const p = vec4.fromValues(x, y, z, -offset);
                renderContext.updateOutlinesUniforms(state.outlines, p, planeIndex);
                const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail,
                    this.rootNodes[NodeGeometryKind.triangles], this.rootNodes[NodeGeometryKind.terrain]);

                this.renderNodeClippingOutline(plane, state, renderNodes);
            }
            if (state.outlines.enabled) {
                renderOutlines(state.outlines.plane, state.outlines.lineColor);
            }
            if (state.clipping.enabled) {
                for (let i = 0; i < state.clipping.planes.length; ++i) {
                    const { normalOffset, outline } = state.clipping.planes[i];
                    if (outline?.enabled) {
                        renderOutlines(normalOffset, outline.lineColor ?? state.outlines.lineColor, i)
                    }
                }
            }
        }

        if (debug) {
            for (const rootNode of Object.values(this.rootNodes)) {
                const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
                glState(gl, {
                    program: programs.debug,
                    uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
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
        const { resources, renderContext } = this;
        const { gl, cameraUniforms, clippingUniforms, samplerSingle, samplerMip, iblTextures, currentState, deviceProfile } = renderContext;
        const { programs, sceneUniforms, samplerNearest, materialTexture, highlightTexture, gradientsTexture } = resources;
        const { diffuse, specular } = iblTextures;
        const state = currentState!;

        for (const rootNode of Object.values(this.rootNodes)) {
            const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail, rootNode);
            glState(gl, {
                program: programs.pick,
                uniformBuffers: [cameraUniforms, clippingUniforms, sceneUniforms, null],
                cull: { enable: true, },
                depth: { test: true, writeMask: true },
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
                this.renderNode(node, mask, meshState, ShaderPass.pick);
            }
            gl.bindTexture(gl.TEXTURE_2D, null);

            if (rootNode.geometryKind == NodeGeometryKind.terrain && state.terrain.asBackground) {
                glClear(gl, { kind: "DEPTH_STENCIL", depth: 1.0, stencil: 0 });
            }
        }

        if (deviceProfile.features.outline && state.outlines.on) {
            const renderNodes = this.getRenderNodes(this.projectedSizeSplitThreshold / state.quality.detail,
                this.rootNodes[NodeGeometryKind.triangles],
                state.terrain.asBackground ? undefined : this.rootNodes[NodeGeometryKind.terrain]);

            const renderOutlines = (plane: ReadonlyVec4, planeIndex = -1, color?: RGB) => {
                const [x, y, z, offset] = plane;
                const p = vec4.fromValues(x, y, z, -offset);
                renderContext.updateOutlinesUniforms(state.outlines, p, planeIndex, color);

                this.renderNodeClippingOutline(plane, state, renderNodes);
            }
            if (state.outlines.enabled) {
                renderOutlines(state.outlines.plane);
            }
            if (state.clipping.enabled) {
                for (let i = 0; i < state.clipping.planes.length; ++i) {
                    const { normalOffset, outline } = state.clipping.planes[i];
                    if (outline?.enabled) {
                        renderOutlines(normalOffset, i, outline.lineColor);
                    }
                }
            }
        }
    }

    renderNode(node: OctreeNode, mask: number, meshState: MeshState, pass: ShaderPass) {
        const { renderContext } = this;
        const { gl } = renderContext;
        const { resources } = this;
        const { programs } = resources;
        const { data } = node;
        const prepass = pass == ShaderPass.pre;
        if (node.uniforms) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO.node, node.uniforms);
            for (const mesh of node.meshes) {
                const { materialType } = mesh;
                const isTransparent = materialType == MaterialType.transparent;
                if (prepass && isTransparent)
                    continue;
                gl.bindVertexArray(prepass ? mesh.vaoPosOnly : mesh.vao);
                const mode = mesh.materialType == MaterialType.elevation ? ShaderMode.terrain : mesh.drawParams.mode == "POINTS" ? ShaderMode.points : ShaderMode.triangles;
                if (meshState.mode != mode) {
                    meshState.mode = mode;
                    gl.useProgram(programs[pass][mode]);
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
                if (pass == ShaderPass.color || pass == ShaderPass.pick) {
                    gl.bindTexture(gl.TEXTURE_2D, mesh.baseColorTexture ?? resources.defaultBaseColorTexture);
                }
                if (mask == data.childMask) {
                    const stats = glDraw(gl, mesh.drawParams);
                    renderContext.addRenderStatistics(stats);
                } else {
                    // determine which portions of the parent node must be rendered based on what children currently don't render themselves
                    const multiDrawParams = getMultiDrawParams(mesh, mask);
                    if (multiDrawParams) {
                        const stats = glDraw(gl, multiDrawParams);
                        renderContext.addRenderStatistics(stats);
                    }
                }
            }
        }
    }

    renderNodeClippingOutline(plane: ReadonlyVec4, state: DerivedRenderState, renderNodes: readonly RenderNode[]) {
        const begin = performance.now();
        const { gl, outlineRenderers } = this.renderContext;
        const { highlights } = this;
        let outlineRenderer = outlineRenderers.get(plane);
        if (!outlineRenderer) {
            const [x, y, z, offset] = plane;
            const p = vec4.fromValues(x, y, z, -offset);
            //TODO: Sync with renderstate.
            const edgeAngleThreshold = state.outlines.breakingPointAngleThreshold; // don't render intersecting edges (as points) that has smaller angles than this threshold between their neighboring triangles.
            const minVertexSpacing = state.outlines.linearThickness;
            outlineRenderer = new OutlineRenderer(this, state.localSpaceTranslation, p, edgeAngleThreshold, minVertexSpacing, highlights);
            outlineRenderers.set(plane, outlineRenderer);
        }
        let lineCount = 0, pointCount = 0;
        // TODO: offload to worker (mainly to avoid timeout and stuttering)?
        const [...lineClusters] = outlineRenderer.intersectTriangles(renderNodes);
        {
            const buffers = outlineRenderer.makeBuffers(lineClusters, state);
            if (buffers) {
                const { linesCount, pointsCount, linesVAO, pointsVAO } = buffers;
                lineCount = linesCount;
                pointCount = pointsCount;
                outlineRenderer.renderLines(linesCount, linesVAO);
                outlineRenderer.renderPoints(pointsCount, pointsVAO);
                glDelete(gl, [linesVAO, pointsVAO]);
            }
        }
        const end = performance.now();
        // console.log(`lines: ${lineCount}, points: ${pointCount} time:${end - begin}`);
    }

    renderNodeDebug(node: OctreeNode) {
        const { renderContext } = this;
        const { gl } = renderContext;

        if (node.renderedChildMask && node.uniforms) {
            gl.bindBufferBase(gl.UNIFORM_BUFFER, UBO.node, node.uniforms ?? null);
            const stats = glDraw(gl, { kind: "arrays", mode: "TRIANGLES", count: 8 * 12 });
            renderContext.addRenderStatistics(stats);
        }
    }

    contextLost() {
        const { loader, rootNodes } = this;
        loader.abortAll();
        for (const rootNode of Object.values(rootNodes)) {
            rootNode?.dispose(); // consider retaining submesh js data
        }
    }

    dispose() {
        this.contextLost();
        this.resources.bin.dispose();
        this.disposeRootNodes();
    }

    private disposeRootNodes() {
        for (const rootNode of Object.values(this.rootNodes)) {
            rootNode.dispose();
        }
        this.rootNodes = {};
    }

    private async reloadScene(scene: RenderStateScene) {
        this.suspendUpdates = true;
        await this.loader.abortAllPromise; // make sure we wait for any previous aborts to complete
        const rootNodes = await createSceneRootNodes(this, scene.config, this.renderContext.deviceProfile);
        if (rootNodes) {
            this.disposeRootNodes();
            this.rootNodes = rootNodes;
        }
        this.suspendUpdates = false;
        this.renderContext.changed = true;
    }

    private updateHighlightTexture(highlights?: RenderStateHighlightGroups) {
        const { renderContext, resources } = this;
        highlights ??= renderContext.prevState?.highlights;
        if (highlights) {
            const { gl } = renderContext;
            const image = createColorTransforms(highlights, this.textureValid);
            glUpdateTexture(gl, resources.highlightTexture, { kind: "TEXTURE_2D", width: 256, height: 8, internalFormat: "RGBA32F", type: "FLOAT", image });
        }
    }

    private async loadMaterialTextures(textures: Iterable<LoadTextureParams>): Promise<void> {
        const { renderContext, textureValid } = this;
        const { materialFiles, materialCommon } = renderContext;
        if (!materialCommon)
            return;

        // mark all loading textures as invalid.
        for (const { index } of textures) {
            textureValid[index] = false;
        }
        this.updateHighlightTexture();
        renderContext.changed = true;

        if (materialFiles) {
            for (let { source, index } of textures) {
                const file = materialFiles.get(`${source.pathname.substring(1)}`);
                if (file) {
                    const data = await createPBRMaterial(materialCommon, file);
                    this.updateMaterialTextures(index, data);
                } else {
                    throw new Error(`File ${file} not found!`);
                }
            }
        } else {
            for (const { source, index } of textures) {
                const data = await createPBRMaterial(materialCommon, source as URL);
                this.updateMaterialTextures(index, data);
            }
        }

        // mark all loaded textures as valid.
        for (const { index } of textures) {
            textureValid[index] = true;
        }
        this.updateHighlightTexture();
        renderContext.changed = true;
    }

    updateMaterialTextures(index: ActiveTextureIndex, source: PBRMaterialTextures) {
        const { renderContext, materialTextures } = this;
        const { gl, materialCommon } = renderContext;
        if (!materialCommon)
            return;
        for (let level = 0; level < materialCommon.mipCount; level++) {
            const width = materialCommon.width >> level;
            const height = materialCommon.width >> level;
            function updateParams(format: UncompressedTextureFormatType, image: ArrayBufferView): TextureUpdateParams2DArrayUncompressed {
                return {
                    kind: "TEXTURE_2D_ARRAY",
                    level, z: index, width, height, depth: 1,
                    ...format,
                    image,
                };
            }
            glUpdateTexture(gl, materialTextures.color!, updateParams({ internalFormat: "R11F_G11F_B10F", type: "UNSIGNED_INT_10F_11F_11F_REV" }, source.albedoTexture[level]));
            glUpdateTexture(gl, materialTextures.nor!, updateParams({ internalFormat: "RGBA8", type: "UNSIGNED_BYTE" }, source.norTexture[level]));
        }
        renderContext.changed = true;
    }
}

function makeMaterialAtlas(state: DerivedRenderState) {
    const { scene } = state;
    if (scene) {
        const { config } = scene;
        const { numMaterials } = config;
        if (numMaterials) {
            const { diffuse, opacity } = config.materialProperties;
            console.assert(numMaterials <= 256);
            function zeroes() { return new Uint8ClampedArray(numMaterials); };
            function ones() { const a = new Uint8ClampedArray(numMaterials); a.fill(255); return a; };
            const red = decodeBase64(diffuse.red, Uint8ClampedArray) ?? zeroes();
            const green = decodeBase64(diffuse.green, Uint8ClampedArray) ?? zeroes();
            const blue = decodeBase64(diffuse.blue, Uint8ClampedArray) ?? zeroes();
            const alpha = decodeBase64(opacity, Uint8ClampedArray) ?? ones();
            const srcData = interleaveRGBA(red, green, blue, alpha);
            return srcData;
        }
    }
}


const enum Highlight {
    default = 0,
    hidden = 0xfe,
    filtered = 0xff,
}

function updateHighlightBuffer(buffer: Uint8Array, highlight: RenderStateHighlightGroups) {
    const { defaultAction, groups } = highlight;
    function getIndex(action: RenderStateGroupAction | undefined, value: number) {
        return action == "hide" ? Highlight.hidden : action == "filter" ? Highlight.filtered : value;
    }
    const defaultValue = getIndex(defaultAction, Highlight.default);
    buffer.fill(defaultValue);
    // apply highlight groups
    let groupIndex = 1;
    for (const group of groups) {
        const idx = getIndex(group.action, groupIndex);
        for (const objectId of group.objectIds) {
            buffer[objectId] = idx;
        }
        groupIndex++;
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

function createColorTransforms(highlights: RenderStateHighlightGroups, textureValid: readonly boolean[]) {
    const numColorMatrices = 256;
    const numColorMatrixCols = 8;
    const numColorMatrixRows = 4;

    const colorMatrices = new Float32Array(numColorMatrices * numColorMatrixRows * numColorMatrixCols);
    // initialize with identity matrices
    for (let i = 0; i < numColorMatrices; i++) {
        for (let j = 0; j < numColorMatrixCols; j++) {
            colorMatrices[(numColorMatrices * j + i) * 4 + j] = i == j ? 1 : 0;
        }
    }

    function copyMatrix(index: number, rgbaTransform: RGBATransform, texture?: RenderStateHighlightGroupTexture) {
        // set color transform matrix
        for (let col = 0; col < 5; col++) {
            for (let row = 0; row < numColorMatrixRows; row++) {
                colorMatrices[(numColorMatrices * col + index) * 4 + row] = rgbaTransform[col + row * 5];
            }
        }
        // set texture info
        const textureInfoCol0 = 5;
        const textureInfoCol1 = 6;
        let i: number = -1;
        if (texture && textureValid[texture.index]) {
            i = texture.index;
        }
        const s = 1 / (texture?.scale ?? 1);
        const a = glMatrix.toRadian(texture?.rotation ?? 0);
        const x = Math.cos(a) * s;
        const y = Math.sin(a) * s;
        const m = texture?.metalness ?? 0;
        const ambient = texture?.ambient ?? 0;
        const textureInfo0 = [i, x, y, m];
        const textureInfo1 = [0, 0, 0, ambient];
        for (let row = 0; row < numColorMatrixRows; row++) {
            colorMatrices[(numColorMatrices * textureInfoCol0 + index) * 4 + row] = textureInfo0[row];
            colorMatrices[(numColorMatrices * textureInfoCol1 + index) * 4 + row] = textureInfo1[row];
        }
    }
    // Copy transformation matrices
    const { defaultAction, groups } = highlights;
    copyMatrix(0, getRGBATransform(defaultAction));
    for (let i = 0; i < groups.length; i++) {
        copyMatrix(i + 1, getRGBATransform(groups[i].action), groups[i].texture);
    }
    return colorMatrices;
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

const defaultRGBATransform: RGBATransform = [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,];


function getRGBATransform(action: RenderStateGroupAction | undefined): RGBATransform {
    return (typeof action != "string" && Array.isArray(action)) ? action : defaultRGBATransform;
}

const enum VertexAttributeIds {
    position,
    normal,
    material,
    objectId,
    texCoord0,
    color0,
    projectedPos,
    deviations,
    highlight,
};

interface MeshState {
    mode?: ShaderMode;
    doubleSided?: boolean;
}

interface LoadTextureParams {
    readonly index: ActiveTextureIndex;
    readonly source: URL;
}