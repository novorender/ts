import { mat4, ReadonlyVec3, ReadonlyVec4, vec3, vec4 } from "gl-matrix";
import { DrawParams, DrawParamsArraysMultiDraw, DrawParamsElementsMultiDraw } from "webgl2";
import { CoordSpace, DerivedRenderState, RenderContext } from "core3d";
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
    private readonly center4: ReadonlyVec4;
    private readonly corners: ReadonlyVec4[];

    state = NodeState.collapsed;
    download: AbortableDownload | undefined;
    visibility = Visibility.undefined;
    projectedSize = 0;
    uniformsBuffer: WebGLBuffer | undefined;

    constructor(readonly context: OctreeContext, readonly data: NodeData) {
        // create uniform buffer
        const { sphere, box } = data.bounds;
        const { center, radius } = sphere;
        this.id = data.id;
        this.center = center;
        this.radius = radius;
        this.center4 = vec4.fromValues(center[0], center[1], center[2], 1);
        const [x0, y0, z0] = box.min;
        const [x1, y1, z1] = box.max;
        this.corners = [
            vec4.fromValues(x0, y0, z0, 1),
            vec4.fromValues(x1, y0, z0, 1),
            vec4.fromValues(x0, y1, z0, 1),
            vec4.fromValues(x1, y1, z0, 1),
            vec4.fromValues(x0, y0, z1, 1),
            vec4.fromValues(x1, y0, z1, 1),
            vec4.fromValues(x0, y1, z1, 1),
            vec4.fromValues(x1, y1, z1, 1),
        ];

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
        if (uniformsBuffer) {
            renderer.deleteBuffer(uniformsBuffer);
            this.uniformsBuffer = undefined;
        }
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

    get renderedChildMask() {
        let { childMask } = this.data;
        for (const child of this.children) {
            if (child.hasGeometry) {
                childMask &= ~(1 << child.data.childIndex);
            }
        }
        return childMask;
    }

    private shouldSplit(projectedSizeSplitThreshold: number): boolean {
        const { visibility, projectedSize } = this;
        return this.isRoot || (visibility != Visibility.none && projectedSize > projectedSizeSplitThreshold);
    }

    private computeVisibility(state: DerivedRenderState): Visibility {
        const { center4, radius, corners } = this;
        let fullyInside = true;
        let fullyOutside = false;
        const { planes } = state.viewFrustum;
        for (const plane of planes) {
            const distance = vec4.dot(plane, center4);
            if (distance > radius) {
                fullyOutside = true;
                fullyInside = false;
                break;
            } else if (distance > -radius)
                fullyInside = false;
        }
        if (fullyInside === fullyOutside) {
            // check against corders of bounding box
            fullyOutside = true;
            fullyInside = true;
            for (const corner of corners) {
                for (const plane of planes) {
                    const distance = vec4.dot(plane, corner);
                    if (distance > 0) {
                        fullyInside = false;
                    } else {
                        fullyOutside = false;
                    }
                }
            }
        }
        let visibility = Visibility.undefined;
        if (fullyOutside) {
            visibility = Visibility.none;
        } else if (!fullyInside) {
            visibility = Visibility.partial;
        } else {
            visibility = Visibility.full;
        }
        return visibility;
    }


    update(state: DerivedRenderState, parentVisibility: Visibility = Visibility.partial) {
        // update visibility
        this.visibility = (parentVisibility == Visibility.partial) ? this.computeVisibility(state) : parentVisibility;

        // update projected size
        const { center4, visibility, radius, children } = this;
        const { camera, matrices, viewFrustum } = state;
        const imagePlane = viewFrustum.image;
        const projection = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        if (visibility <= Visibility.none) {
            this.projectedSize = 0;
        } else if (camera.kind == "pinhole") {
            const distance = Math.max(0.001, vec4.dot(imagePlane, center4) - radius); // we subtract radius to get the projection size at the extremity nearest the camera
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
            child.update(state, visibility);
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
        const { context, data, uniformsData, uniformsBuffer, visibility, state } = this;
        const { renderContext } = context;
        const { renderer, cameraUniformsBuffer } = renderContext;

        if (this.renderedChildMask) {
            if (uniformsBuffer) {
                let r = 0, g = 0, b = 0;
                switch (visibility) {
                    case Visibility.partial: g = 0.25; break;
                    case Visibility.full: g = 1; break;
                }
                switch (state) {
                    case NodeState.downloading: r = 1; break;
                    case NodeState.ready: b = 1; break;
                }
                uniformsData.uniforms.debugColor = vec4.fromValues(r, g, b, 1);
                renderer.update({ kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniformsBuffer });
            }

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