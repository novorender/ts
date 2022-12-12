import { mat4, ReadonlyMat4, ReadonlyVec3, ReadonlyVec4, vec3, vec4 } from "gl-matrix";
import { createUniformsProxy, glDraw, DrawParams, DrawParamsArraysMultiDraw, DrawParamsElementsMultiDraw, glState, glBuffer, glUpdateBuffer } from "webgl2";
import { CoordSpace, DerivedRenderState, RenderContext } from "core3d";
import { AbortableDownload, Downloader } from "./download";
import { createMeshes, deleteMesh, Mesh, meshPrimitiveCount } from "./mesh";
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
    readonly debug: boolean;
    readonly localSpaceChanged: boolean;
    readonly localWorldMatrix: ReadonlyMat4;
    readonly worldLocalMatrix: ReadonlyMat4;
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
    viewDistance = 0;
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
            modelLocalMatrix: "mat4",
            debugColor: "vec4",
            min: "vec3",
            max: "vec3",
        });


        const { offset, scale } = data;
        const modelWorldMatrix = mat4.fromTranslation(mat4.create(), offset);
        mat4.scale(modelWorldMatrix, modelWorldMatrix, vec3.fromValues(scale, scale, scale));
        this.uniformsData.values.modelLocalMatrix = modelWorldMatrix;
    }

    dispose() {
        const { context, meshes, uniforms, children } = this;
        const { renderContext } = context;
        const { gl } = renderContext;
        for (const mesh of meshes) {
            deleteMesh(gl, mesh);
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

    get renderedPrimitives() {
        let numPrimitives = 0;
        if (this.visibility != Visibility.none) {
            const { renderedChildMask } = this;
            if (renderedChildMask) {
                for (const mesh of this.meshes) {
                    numPrimitives += meshPrimitiveCount(mesh, renderedChildMask);
                }
            }
        }
        return numPrimitives;
    }

    update(state: DerivedRenderState, parentVisibility: Visibility = Visibility.partial) {
        // update visibility
        this.visibility = (parentVisibility == Visibility.partial) ? this.computeVisibility(state) : parentVisibility;

        // update projected size
        const { context, center4, visibility, radius, uniforms, data, uniformsData, children } = this;
        const { camera, matrices, viewFrustum } = state;
        const imagePlane = viewFrustum.image;
        const projection = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        const viewDistance = this.viewDistance = vec4.dot(imagePlane, center4);
        if (visibility <= Visibility.none) {
            this.projectedSize = 0;
        } else if (camera.kind == "pinhole") {
            const distance = Math.max(0.001, viewDistance - radius); // we subtract radius to get the projection size at the extremity nearest the camera
            this.projectedSize = (this.size * projection[5]) / (-distance * projection[11]);
        } else {
            this.projectedSize = this.size * projection[5];
        }

        if (context.debug) {
            let r = 0, g = 0, b = 0;
            switch (visibility) {
                case Visibility.partial: g = 0.25; break;
                case Visibility.full: g = 1; break;
            }
            switch (this.state) {
                case NodeState.downloading: r = 1; break;
                case NodeState.ready: b = 1; break;
            }
            const { offset, scale } = data;
            const modelWorldMatrix = mat4.fromTranslation(mat4.create(), offset);
            const worldModelMatrix = mat4.invert(mat4.create(), modelWorldMatrix);
            const { min, max } = data.bounds.box;
            const { values } = uniformsData;
            values.debugColor = vec4.fromValues(r, g, b, 1);
            values.min = vec3.transformMat4(vec3.create(), min, worldModelMatrix);
            values.max = vec3.transformMat4(vec3.create(), max, worldModelMatrix);
            if (uniforms) {
                glUpdateBuffer(context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniforms });
            }
        }

        // recurse down the tree
        for (const child of children) {
            child.update(state, this.visibility);
        }
    }

    async downloadGeometry() {
        try {
            const { context, children, meshes, data } = this;
            const { renderContext, downloader, version } = context;
            const { gl } = renderContext;
            const download = downloader.downloadArrayBufferAbortable(this.path, new ArrayBuffer(data.byteSize));
            this.download = download;
            this.state = NodeState.downloading;
            const buffer = await download.result;
            if (buffer) {
                this.download = undefined;
                const { childInfos, geometry } = parseNode(this.id, false, version, buffer);
                for (const data of childInfos) {
                    const child = new OctreeNode(context, data);
                    children.push(child);
                }
                this.state = NodeState.ready;
                meshes.push(...createMeshes(gl, geometry));
                this.uniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: this.uniformsData.buffer.byteLength });
                glUpdateBuffer(this.context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: this.uniformsData.buffer, targetBuffer: this.uniforms });

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