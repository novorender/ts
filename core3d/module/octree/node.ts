import { CoordSpace } from "@novorender/core3d/matrices";
import { DerivedRenderState, RenderContext } from "core3d";
import { mat4, ReadonlyVec3, vec3 } from "gl-matrix";
import { createUniformBufferProxy } from "../uniforms";
import { AbortableDownload } from "./download";
import { createMeshes, Mesh } from "./mesh";
import { NodeData, parseNode } from "./parser";

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

export class OctreeNode {
    readonly id: string;
    readonly center: ReadonlyVec3;
    readonly radius: number;
    readonly size: number;
    readonly children: OctreeNode[] = [];
    readonly uniformsData;
    readonly meshes: Mesh[] = [];

    uniformsBuffer: WebGLBuffer | undefined;
    download: AbortableDownload | undefined;
    visibility = Visibility.undefined;
    projectedSize = 0;
    state = NodeState.collapsed;

    constructor(readonly context: RenderContext, readonly data: NodeData) {
        // create uniform buffer
        const { sphere } = data.bounds;
        this.id = data.id;
        this.center = sphere.center;
        this.radius = sphere.radius;
        const toleranceScale = 128; // an approximate scale for tolerance to projected pixels
        this.size = Math.pow(2, data.tolerance) * toleranceScale;
        this.uniformsData = createUniformBufferProxy({
            objectClipMatrix: "mat4",
        });
    }

    dispose() {
        const { context, meshes, uniformsBuffer } = this;
        const { renderer } = context;
        for (const mesh of meshes) {
            renderer.deleteVertexArray(mesh.vao);
        }
        meshes.length = 0;
        if (uniformsBuffer)
            renderer.deleteBuffer(uniformsBuffer);
    }

    get path() {
        return `${this.id}`;
    }

    get isSplit() {
        return this.state != NodeState.collapsed;
    }

    get hasGeometry() {
        return this.meshes.length > 0;
    }

    update(state: DerivedRenderState) {
        // update visibility
        // this.visibility = (parentVisibility == Visibility.partial) ? this.computeVisibility(planes) : parentVisibility;
        this.visibility = Visibility.full;

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

        // update children
        for (const child of children) {
            child.update(state);
        }
    }

    render(cameraUniformsBuffer: WebGLBuffer) {
        const { context, uniformsData, uniformsBuffer } = this;
        const { renderer } = context;
        if (uniformsBuffer && !uniformsData.dirtyRange.isEmpty) {
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer, targetBuffer: uniformsBuffer });
            uniformsData.dirtyRange.reset();
        }
        renderer.state({
            // program,
            uniformBuffers: [cameraUniformsBuffer, uniformsBuffer],
            depthTest: true,
            depthWriteMask: true,
            cullEnable: false, // double sided (for now)
        });
        for (const mesh of this.meshes) {
            renderer.state({
                vertexArrayObject: mesh.vao,
            });
            renderer.draw(mesh.drawParams);
        }
    }

    shouldSplit(projectedSizeSplitThreshold: number): boolean {
        const { visibility, projectedSize } = this;
        return visibility != Visibility.none && projectedSize > projectedSizeSplitThreshold;
    }

    beginDownload(download: AbortableDownload) {
        this.download = download;
        this.state = NodeState.downloading;
    }

    endDownload(version: string, buffer: ArrayBuffer) {
        const { context, children, meshes, data, uniformsData } = this;
        const { renderer } = context;
        console.assert(children.length == 0);
        console.assert(meshes.length == 0);
        this.download = undefined;
        const transformIndex = 0; // TODO: allocate/remove?
        const { childInfos, geometry } = parseNode(this.id, transformIndex, version, buffer);
        for (const data of childInfos) {
            const child = new OctreeNode(this.context, data);
            children.push(child);
        }
        this.state = NodeState.ready;
        meshes.push(...createMeshes(renderer, geometry, data.primitiveType));
        this.uniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniformsData.buffer });
    }
}