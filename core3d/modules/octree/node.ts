import { mat4, type ReadonlyVec3, type ReadonlyVec4, vec3, vec4 } from "gl-matrix";
import { glUBOProxy, glUpdateBuffer } from "webgl2";
import { CoordSpace, type DerivedRenderState, RenderContext, type RenderStateHighlightGroup } from "core3d";
import { createMeshes, deleteMesh, type Mesh, meshPrimitiveCount, updateMeshHighlights } from "./mesh";
import type { NodeData } from "./worker";
import { NodeLoader } from "./loader";
import { ResourceBin } from "core3d/resource";

/** @internal */
export const enum Visibility {
    undefined,
    none,
    partial,
    full,
};

/** @internal */
export const enum NodeState {
    collapsed,
    requestDownload,
    downloading,
    ready,
}

/** @internal */
export const enum NodeGeometryKind {
    terrain,
    triangles,
    lines,
    points,
    documents,
};

/** @internal */
export const enum NodeGeometryKindMask {
    none = 0,
    terrain = 1 << NodeGeometryKind.terrain,
    triangles = 1 << NodeGeometryKind.triangles,
    lines = 1 << NodeGeometryKind.lines,
    points = 1 << NodeGeometryKind.points,
    documents = 1 << NodeGeometryKind.documents,
    all = terrain | triangles | lines | points | documents,
};

/** @internal */
export interface OctreeContext {
    readonly renderContext: RenderContext;
    readonly loader: NodeLoader;
    readonly url: string | undefined;
    readonly version: string;
    readonly debug: boolean;
    readonly localSpaceChanged: boolean;
    readonly hidden: readonly boolean[]; // corresponds to NodeGeometryKind
    readonly highlights: Uint8Array;
    readonly highlightGeneration: number;
}

/** @internal */
export class OctreeNode {
    readonly id: string;
    readonly parent: OctreeNode | undefined;
    readonly resourceBin: ResourceBin
    readonly center: ReadonlyVec3;
    readonly radius: number;
    readonly size: number;
    readonly children: OctreeNode[] = [];
    readonly meshes: Mesh[] = [];
    readonly uniformsData;
    readonly geometryKind: NodeGeometryKind;
    uniforms: WebGLBuffer | undefined;
    private readonly center4: ReadonlyVec4;
    private readonly corners: ReadonlyVec4[];
    private hasValidModelLocalMatrix = false;
    state = NodeState.collapsed;
    download: { abort(): void } | undefined;
    visibility = Visibility.undefined;
    viewDistance = 0;
    projectedSize = 0;
    static readonly errorModifiersPinhole = {
        [NodeGeometryKind.terrain]: .05,
        [NodeGeometryKind.triangles]: 1,
        [NodeGeometryKind.lines]: .5,
        [NodeGeometryKind.points]: .35,
        [NodeGeometryKind.documents]: .08,
    };
    static readonly errorModifiersOrtho = {
        [NodeGeometryKind.terrain]: .25,
        [NodeGeometryKind.triangles]: 5,
        [NodeGeometryKind.lines]: 2.5,
        [NodeGeometryKind.points]: .75,
        [NodeGeometryKind.documents]: .4,
    };

    constructor(readonly context: OctreeContext, readonly data: NodeData, parent: OctreeNode | NodeGeometryKind) {
        this.geometryKind = typeof parent == "object" ? parent.geometryKind : parent;
        this.parent = typeof parent == "object" ? parent : undefined;
        // create uniform buffer
        const { sphere, box } = data.bounds;
        const { center, radius } = sphere;
        this.id = data.id;
        this.resourceBin = context.renderContext.resourceBin("Node");
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


        // const toleranceScale = 128; // an approximate scale for tolerance to projected pixels
        // this.size = Math.pow(2, data.tolerance) * toleranceScale;
        this.size = Math.max(box.max[0] - box.min[0], Math.max(box.max[1] - box.min[1], box.max[2] - box.min[2])) * 4;
        // this.size = data.nodeSize * errorModifier;
        this.uniformsData = glUBOProxy({
            modelLocalMatrix: "mat4",
            tolerance: "float",
            debugColor: "vec4",
            min: "vec3",
            max: "vec3",
        });
        this.uniformsData.values.tolerance = Math.pow(2, data.tolerance);
    }

    dispose() {
        const { meshes, uniforms, children, resourceBin } = this;
        for (const mesh of meshes) {
            deleteMesh(resourceBin, mesh);
        }
        if (uniforms) {
            resourceBin.delete(uniforms);
            this.uniforms = undefined;
        }
        console.assert(resourceBin.size == 0);
        resourceBin.dispose();
        for (const child of children) {
            child.dispose();
        }
        meshes.length = 0;
        children.length = 0;
        this.download?.abort();
        this.download = undefined;
        this.state = NodeState.collapsed;
    }

    get isRoot() {
        return !this.parent;
    }

    get path() {
        return this.id;
    }

    get isSplit() {
        return this.state != NodeState.collapsed;
    }

    get hasGeometry() {
        return this.meshes.length > 0 || this.uniforms != undefined;
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
        const { visibility, projectedSize, context, geometryKind } = this;
        const hidden = context.hidden[geometryKind ?? -1] ?? false;
        return !hidden && (this.isRoot || (visibility != Visibility.none && projectedSize > projectedSizeSplitThreshold)) && !this.areAllDescendantsHidden;
    }

    get areAllDescendantsHidden() {
        const { descendantObjectIds } = this.data;
        if (descendantObjectIds) {
            const { highlights } = this.context;
            // We assume descendantObjectIds are rare and small. Otherwise this check should probably be optimized by performing this check only on recent loads or when highligts changes.
            if (descendantObjectIds.every(id => highlights[id] >= 0xfe)) {
                return true;
            }
        }
        return false;
    }

    intersectsPlane(plane: ReadonlyVec4) {
        const { center4, radius, corners } = this;
        const distance = vec4.dot(plane, center4);
        if (Math.abs(distance) > radius) {
            return false;
        }
        let side = 0;
        for (const corner of corners) {
            const distance = vec4.dot(plane, corner);
            const distSgn = Math.sign(distance);
            if (side && distSgn != side) {
                return true;
            }
            if (distSgn) {
                side = distSgn;
            }
        }
        return false;
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
            this.projectedSize = (this.size * OctreeNode.errorModifiersPinhole[this.geometryKind] * projection[5]) / (-distance * projection[11]);
            // const exp = 2; //Scale the prioritization of nodes that is closer to the camera.
            // this.projectedSize = (this.size * projection[5]) / (-distance * Math.pow(-distance, exp) / Math.pow(10, exp) * projection[11]);
        } else {
            this.projectedSize = this.size * OctreeNode.errorModifiersOrtho[this.geometryKind] * projection[5];
        }

        if (context.localSpaceChanged || !this.hasValidModelLocalMatrix) {
            const { values } = this.uniformsData;
            values.modelLocalMatrix = this.getModelLocalMatrix(state.localSpaceTranslation);
            if (uniforms) {
                glUpdateBuffer(context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniforms });
            }
            this.hasValidModelLocalMatrix = true;
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
            const worldLocalMatrix = mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), state.localSpaceTranslation));
            const { min, max } = data.bounds.box;
            const { values } = uniformsData;
            values.debugColor = vec4.fromValues(r, g, b, 1);
            values.min = vec3.transformMat4(vec3.create(), min, worldLocalMatrix);
            values.max = vec3.transformMat4(vec3.create(), max, worldLocalMatrix);
            if (uniforms) {
                glUpdateBuffer(context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniforms });
            }
        }

        // recurse down the tree
        for (const child of children) {
            child.update(state, this.visibility);
        }
    }

    async downloadNode() {
        const { context, children, meshes, resourceBin } = this;
        const { renderContext, loader, version, highlightGeneration } = context;
        this.state = NodeState.downloading;
        const payload = await loader.loadNode(this, version); // do actual downloading and parsing in worker
        if (payload) {
            const { childInfos, geometry } = payload;
            for (const data of childInfos) {
                const child = new OctreeNode(context, data, this);
                children.push(child);
            }
            meshes.push(...createMeshes(resourceBin, geometry));
            // check if highlights buffer has changed since the node was parsed
            if (context.highlightGeneration != highlightGeneration) {
                OctreeNode.updateHighlights(context, meshes);
            }
            this.uniforms = resourceBin.createBuffer({ kind: "UNIFORM_BUFFER", byteSize: this.uniformsData.buffer.byteLength });
            glUpdateBuffer(this.context.renderContext.gl, { kind: "UNIFORM_BUFFER", srcData: this.uniformsData.buffer, targetBuffer: this.uniforms });
            renderContext.changed = true;
            this.state = NodeState.ready;
        } else {
            this.state = NodeState.collapsed;
        }
    }

    getModelLocalMatrix(localSpaceTranslation: ReadonlyVec3) {
        let { offset, scale } = this.data;
        const [ox, oy, oz] = offset;
        const [tx, ty, tz] = localSpaceTranslation;
        const modelLocalMatrix = mat4.fromValues(
            scale, 0, 0, 0,
            0, scale, 0, 0,
            0, 0, scale, 0,
            ox - tx, oy - ty, oz - tz, 1
        );
        return modelLocalMatrix;
    }

    applyHighlights(highlights: Uint8Array | undefined) {
        const { context, meshes } = this;
        const { gl } = context.renderContext;
        for (const mesh of meshes) {
            updateMeshHighlights(gl, mesh, highlights);
        }
    }

    static updateHighlights(context: OctreeContext, meshes: readonly Mesh[]) {
        const { renderContext, highlights } = context;
        const { gl } = renderContext;
        for (const mesh of meshes) {
            updateMeshHighlights(gl, mesh, highlights);
        }
    }
}
