import { mat4, ReadonlyVec3, ReadonlyVec4, vec3, vec4 } from "gl-matrix";
import { createUniformsProxy, glDraw, DrawParams, DrawParamsArraysMultiDraw, DrawParamsElementsMultiDraw, glState, glBuffer, glUpdateBuffer } from "webgl2";
import { CoordSpace, DerivedRenderState, RenderContext } from "core3d";
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
    uniforms: WebGLBuffer | undefined;
    private readonly center4: ReadonlyVec4;
    private readonly corners: ReadonlyVec4[];
    state = NodeState.collapsed;
    download: AbortableDownload | undefined;
    visibility = Visibility.undefined;
    projectedSize = 0;

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
        this.uniformsData = createUniformsProxy({
            modelViewMatrix: "mat4",
            debugColor: "vec4",
        });
    }

    dispose() {
        const { context, meshes, uniforms, children } = this;
        const { renderContext } = context;
        const { gl } = renderContext;
        for (const mesh of meshes) {
            gl.deleteVertexArray(mesh.vao);
        }
        if (uniforms) {
            gl.deleteBuffer(uniforms);
            this.uniforms = undefined;
        }
        meshes.length = 0;
        children.length = 0;
        this.download?.abort();
        this.download = undefined;
        this.state = NodeState.collapsed;
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

    shouldSplit(projectedSizeSplitThreshold: number): boolean {
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

    get renderedTriangles() {
        let numTriangles = 0;
        if (this.visibility != Visibility.none) {
            const { renderedChildMask } = this;
            if (renderedChildMask) {
                for (const mesh of this.meshes) {
                    const renderedRanges = mesh.drawRanges.filter(r => ((1 << r.childIndex) & renderedChildMask) != 0);
                    const primitiveType = mesh.drawParams.mode ?? "TRIANGLES";
                    for (const drawRange of renderedRanges) {
                        numTriangles += calcNumTriangles(drawRange.count, primitiveType);
                    }
                }
            }
        }
        return numTriangles;
    }

    update(state: DerivedRenderState, parentVisibility: Visibility = Visibility.partial) {
        // update visibility
        this.visibility = (parentVisibility == Visibility.partial) ? this.computeVisibility(state) : parentVisibility;

        // update projected size
        const { center4, visibility, radius, uniforms, data, uniformsData } = this;
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
        const { offset, scale } = data;
        const { values } = this.uniformsData;
        const worldViewMatrix = state.matrices.getMatrix(CoordSpace.World, CoordSpace.View);
        const modelWorldMatrix = mat4.fromTranslation(mat4.create(), offset);
        mat4.scale(modelWorldMatrix, modelWorldMatrix, vec3.fromValues(scale, scale, scale));
        const modelViewMatrix = mat4.mul(mat4.create(), worldViewMatrix, modelWorldMatrix);
        values.modelViewMatrix = modelViewMatrix;
        if (uniforms) {
            glUpdateBuffer(this.context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniforms });
        }
    }

    render(uniformBuffers: WebGLBuffer[], prepass = false, writeZ = true) {
        const { context, data, uniforms, uniformsData } = this;
        const { renderContext } = context;
        const { gl } = renderContext;
        if (uniforms) {
            renderContext.updateUniformBuffer(uniforms, uniformsData);
        }

        const { renderedChildMask } = this;
        if (renderedChildMask) {
            for (const mesh of this.meshes) {
                const { materialType } = mesh;
                const isTransparent = materialType == MaterialType.transparent;
                if (prepass && isTransparent)
                    continue;
                const blendEnable = isTransparent;
                glState(gl, {
                    uniformBuffers: [...uniformBuffers, uniforms],
                    vertexArrayObject: prepass ? mesh.vaoPosOnly : mesh.vao,
                    cullEnable: materialType == MaterialType.opaque,
                    depthWriteMask: !isTransparent && writeZ,
                    blendEnable,
                    blendSrcRGB: blendEnable ? "SRC_ALPHA" : "ONE",
                    blendSrcAlpha: "ZERO",
                    blendDstRGB: blendEnable ? "ONE_MINUS_SRC_ALPHA" : "ZERO",
                    blendDstAlpha: "ONE",
                });
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

    renderDebug(uniformBuffers: WebGLBuffer[]) {
        const { context, uniforms, uniformsData, visibility, state } = this;
        const { renderContext } = context;
        const { gl } = renderContext;

        if (this.renderedChildMask) {
            let r = 0, g = 0, b = 0;
            switch (visibility) {
                case Visibility.partial: g = 0.25; break;
                case Visibility.full: g = 1; break;
            }
            switch (state) {
                case NodeState.downloading: r = 1; break;
                case NodeState.ready: b = 1; break;
            }
            uniformsData.values.debugColor = vec4.fromValues(r, g, b, 1);
            if (uniforms) {
                renderContext.updateUniformBuffer(uniforms, uniformsData);
            }
        }

        glState(gl, {
            uniformBuffers: [...uniformBuffers, uniforms],
        });
        glDraw(gl, { kind: "arrays", mode: "TRIANGLES", count: 8 * 12 });
    }

    async downloadGeometry() {
        try {
            const { context, children, meshes, data } = this;
            const { renderContext, downloader, version } = context;
            const download = downloader.downloadArrayBufferAbortable(this.path, new ArrayBuffer(this.data.byteSize));
            this.download = download;
            this.state = NodeState.downloading;
            const buffer = await download.result;
            if (buffer) {
                this.download = undefined;
                const { childInfos, geometry } = parseNode(this.id, true, version, buffer);
                for (const data of childInfos) {
                    const child = new OctreeNode(context, data);
                    children.push(child);
                }
                this.state = NodeState.ready;
                meshes.push(...createMeshes(renderContext.gl, geometry));
                this.uniforms = glBuffer(renderContext.gl, { kind: "UNIFORM_BUFFER", size: this.uniformsData.buffer.byteLength });
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
}

function getMultiDrawParams(mesh: Mesh, childMask: number): DrawParamsArraysMultiDraw | DrawParamsElementsMultiDraw | undefined {
    // determine which draw ranges this parent node must render based on what children will render their own mesh
    const drawRanges = mesh.drawRanges.filter(r => ((1 << r.childIndex) & childMask) != 0);
    if (drawRanges.length == 0) {
        return;
    }
    const offsetsList = new Int32Array(drawRanges.map(r => r.byteOffset));
    const countsList = new Int32Array(drawRanges.map(r => r.count));
    const drawCount = offsetsList.length;
    const { drawParams } = mesh;
    const { mode } = drawParams;
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

function calcNumTriangles(indices: number, primitiveType: string) {
    switch (primitiveType) {
        case "TRIANGLES":
            indices /= 3; break;
        case "TRIANGLE_STRIP":
        case "TRIANGLE_FAN":
            indices -= 2; break;
        case "LINES":
            indices /= 2; break;
        case "LINE_STRIP":
            indices -= 1; break;
    }
    return indices;
}
