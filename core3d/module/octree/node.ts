import { CoordSpace } from "@novorender/core3d/matrices";
import { DrawParams, DrawParamsArraysMultiDraw, DrawParamsElementsMultiDraw } from "@novorender/webgl2";
import { DerivedRenderState, RenderContext } from "core3d";
import { mat4, ReadonlyVec3, vec3, vec4 } from "gl-matrix";
import { createUniformBufferProxy } from "../uniforms";
import { AbortableDownload, Downloader } from "./download";
import { createMeshes, Mesh } from "./mesh";
import { NodeData, parseNode } from "./parser";
import { MaterialType } from "./schema";

export const enum Visibility {
    undefined,
    none,
    partial,
    full,
};

export const enum NodeState {
    collapsed,
    requestDownload,
    downloading,
    ready,
}

export interface OctreeContext {
    readonly renderContext: RenderContext;
    readonly downloader: Downloader;
    readonly version: string;
    readonly projectedSizeSplitThreshold: number;
}

export class OctreeNode {
    readonly id: string;
    readonly center: ReadonlyVec3;
    readonly radius: number;
    readonly size: number;
    readonly children: OctreeNode[] = [];
    readonly meshes: Mesh[] = [];
    readonly uniformsData;

    state = NodeState.collapsed;
    download: AbortableDownload | undefined;
    visibility = Visibility.undefined;
    projectedSize = 0;
    uniformsBuffer: WebGLBuffer | undefined;

    constructor(readonly context: OctreeContext, readonly data: NodeData) {
        // create uniform buffer
        const { sphere } = data.bounds;
        this.id = data.id;
        this.center = sphere.center;
        this.radius = sphere.radius;
        const toleranceScale = 128; // an approximate scale for tolerance to projected pixels
        this.size = Math.pow(2, data.tolerance) * toleranceScale;
        this.uniformsData = createUniformBufferProxy({
            objectClipMatrix: "mat4",
            debugColor: "vec4",
        });
    }

    dispose() {
        const { context, meshes, uniformsBuffer, uniformsData, children } = this;
        const { renderContext } = context;
        const { renderer } = renderContext;
        for (const mesh of meshes) {
            renderer.deleteVertexArray(mesh.vao);
        }
        if (uniformsBuffer)
            renderer.deleteBuffer(uniformsBuffer);
        meshes.length = 0;
        children.length = 0;
        this.download = undefined;
        this.state = NodeState.collapsed;
        // mark uniforms as in need of update
        uniformsData.dirtyRange.begin = 0;
        uniformsData.dirtyRange.end = uniformsData.buffer.byteLength;
    }

    get isRoot() {
        return this.id.length == 0;
    }

    get path() {
        return this.id.length == 0 ? "root" : this.id;
    }

    get isSplit() {
        return this.state != NodeState.collapsed;
    }

    get hasGeometry() {
        return this.meshes.length > 0;
    }

    shouldSplit(projectedSizeSplitThreshold: number): boolean {
        const { visibility, projectedSize } = this;
        return this.isRoot || (visibility != Visibility.none && projectedSize > projectedSizeSplitThreshold);
    }

    protected get renderedChildMask() {
        let { childMask } = this.data;
        for (const child of this.children) {
            if (child.hasGeometry) {
                childMask &= ~(1 << child.data.childIndex);
            }
        }
        return childMask;
    }

    update(state: DerivedRenderState) {
        // update visibility
        // this.visibility = (parentVisibility == Visibility.partial) ? this.computeVisibility(planes) : parentVisibility;
        this.visibility = Visibility.full; // TODO: Determine visibility!

        // update projected size
        const { center, visibility, radius, children } = this;
        const { camera, matrices } = state;
        const projection = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        if (visibility <= Visibility.none) {
            this.projectedSize = 0;
        } else if (camera.kind == "pinhole") {
            const distance = Math.max(0.001, vec3.distance(center, camera.position) - radius); // we subtract radius to get the projection size at the extremity nearest the camera
            this.projectedSize = (this.size * projection[5]) / (-distance * projection[11]);
        } else {
            this.projectedSize = this.size * projection[5];
        }

        // update uniforms data        
        const { offset, scale } = this.data;
        const { uniforms } = this.uniformsData;
        const worldClipMatrix = state.matrices.getMatrix(CoordSpace.World, CoordSpace.Clip);
        const modelWorldMatrix = mat4.fromTranslation(mat4.create(), offset);
        // const modelWorldMatrix = mat4.create();
        mat4.scale(modelWorldMatrix, modelWorldMatrix, vec3.fromValues(scale, scale, scale));
        const modelClipMatrix = mat4.mul(mat4.create(), worldClipMatrix, modelWorldMatrix);
        uniforms.objectClipMatrix = modelClipMatrix;
        uniforms.debugColor = vec4.fromValues(0, 1, 0, 1);

        // update children
        for (const child of children) {
            child.update(state);
        }
    }

    render() {
        const { context, data, uniformsData, uniformsBuffer } = this;
        const { renderContext } = context;
        const { renderer, cameraUniformsBuffer } = renderContext;
        if (uniformsBuffer && !uniformsData.dirtyRange.isEmpty) {
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniformsBuffer });
            uniformsData.dirtyRange.reset();
        }
        renderer.state({
            // program,
            uniformBuffers: [cameraUniformsBuffer!, uniformsBuffer],
        });

        const { renderedChildMask } = this;
        if (renderedChildMask) {
            for (const mesh of this.meshes) {
                const { materialType } = mesh;
                const blendEnable = materialType == MaterialType.transparent;
                renderer.state({
                    vertexArrayObject: mesh.vao,
                    cullEnable: materialType == MaterialType.opaque,
                    depthWriteMask: !blendEnable,
                    blendEnable,
                    blendSrcRGB: blendEnable ? "SRC_ALPHA" : "ONE",
                    blendSrcAlpha: "ONE",
                    blendDstRGB: blendEnable ? "ONE_MINUS_SRC_ALPHA" : "ZERO",
                    blendDstAlpha: "ZERO",
                });
                if (renderedChildMask == data.childMask) {
                    renderer.draw(mesh.drawParams);
                } else {
                    // determine which portions of the parent node must be rendered based on what children currently don't render themselves
                    const multiDrawParams = getMultiDrawParams(mesh, renderedChildMask);
                    renderer.draw(multiDrawParams);
                }
            }
        }

        for (const child of this.children) {
            child.render();
        }
    }

    renderDebug() {
        const { context, data, uniformsData, uniformsBuffer } = this;
        const { renderContext } = context;
        const { renderer, cameraUniformsBuffer } = renderContext;

        if (this.renderedChildMask) {
            // if (this.id.length == 0) {
            renderer.state({
                uniformBuffers: [cameraUniformsBuffer!, uniformsBuffer],
            });
            renderer.draw({ kind: "arrays", mode: "TRIANGLES", count: 8 * 12 });
        }

        for (const child of this.children) {
            child.renderDebug();
        }
    }

    lod(state: DerivedRenderState) {
        const { projectedSizeSplitThreshold } = this.context;
        if (this.shouldSplit(projectedSizeSplitThreshold)) {
            if (this.state == NodeState.collapsed) {
                // we should go via state = requestdownload to queue up downloads in prioritized order
                this.downloadGeometry();
            }
        } else if (!this.shouldSplit(projectedSizeSplitThreshold * 0.98)) { // add a little "slack" before collapsing back again
            if (this.state != NodeState.collapsed) {
                this.dispose();
            }
        }
        for (const child of this.children) {
            child.lod(state);
        }
    }

    async downloadGeometry() {
        try {
            const { context } = this;
            const { renderContext, downloader } = context;
            const download = downloader.downloadArrayBufferAbortable(this.path, new ArrayBuffer(this.data.byteSize));
            this.beginDownload(download)
            const buffer = await download.result;
            if (buffer) {
                this.endDownload(buffer);
                renderContext.changed = true;
            }
        } catch (error: any) {
            if (error.name != "AbortError") {
                console.error(error);
            } else {
                console.info(`abort ${this.id}`);
            }
        }
    }

    beginDownload(download: AbortableDownload) {
        this.download = download;
        this.state = NodeState.downloading;
    }

    endDownload(buffer: ArrayBuffer) {
        const { context, children, meshes, data, uniformsData } = this;
        const { renderContext, version } = context;
        const { renderer } = renderContext;
        console.assert(children.length == 0);
        console.assert(meshes.length == 0);
        this.download = undefined;
        const transformIndex = 0; // TODO: allocate/remove?
        const { childInfos, geometry } = parseNode(this.id, transformIndex, version, buffer);
        for (const data of childInfos) {
            const child = new OctreeNode(context, data);
            children.push(child);
        }
        this.state = NodeState.ready;
        meshes.push(...createMeshes(renderer, geometry, data.primitiveType));
        this.uniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer });
    }
}

function getMultiDrawParams(mesh: Mesh, childMask: number): DrawParamsArraysMultiDraw | DrawParamsElementsMultiDraw {
    // determine which draw ranges this parent node must render based on what children will render their own mesh
    const drawRanges = mesh.drawRanges.filter(r => ((1 << r.childIndex) & childMask) != 0);
    const offsetsList = new Int32Array(drawRanges.map(r => r.byteOffset));
    const countsList = new Int32Array(drawRanges.map(r => r.count));
    const drawCount = offsetsList.length;
    const { drawParams } = mesh;
    const { kind, mode } = drawParams;
    function isElements(params: DrawParams): params is DrawParamsElementsMultiDraw {
        return "indexType" in params;
    }
    if (isElements(drawParams)) {
        const { indexType } = drawParams;
        return {
            kind: "elements_multidraw",
            mode,
            drawCount,
            indexType,
            offsetsList,
            countsList
        };
    } else {
        return {
            kind: "arrays_multidraw",
            mode,
            drawCount,
            firstsList: offsetsList,
            countsList
        };
    }
}