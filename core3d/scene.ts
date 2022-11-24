import type { ReadonlyMat4, ReadonlyVec3 } from "gl-matrix";
import type { NodeData } from "./module/octree/parser";
import type { RenderContext, RenderStateScene } from ".";
import { OctreeNode } from "./module/octree/node";

/** Axis-aligned bounding box */
export interface AABB {
    /** minimum coordinates */
    readonly min: ReadonlyVec3;
    /** maximum coordinates */
    readonly max: ReadonlyVec3;
}

/** Bounding sphere */
export interface BoundingSphere {
    /** Sphere center. */
    readonly center: ReadonlyVec3;
    /** Sphere radius. */
    readonly radius: number;
}

export type Base64String = string;

export interface MaterialProperties {
    readonly diffuse: {
        readonly red: Base64String;
        readonly green: Base64String;
        readonly blue: Base64String;
    };
    readonly opacity: Base64String;
    readonly specular: {
        readonly red: Base64String;
        readonly green: Base64String;
        readonly blue: Base64String;
    };
    readonly shininess: Base64String;
}

export interface OctreeSceneConfig {
    readonly kind: "octree";
    readonly id: string;
    readonly version: string;
    readonly offset: ReadonlyVec3;
    readonly scale: number;
    readonly boundingSphere: BoundingSphere; // bounding sphere in model space
    readonly aabb: AABB;
    readonly rootByteSize: number;
    readonly numObjects: number;
    readonly numMaterials: number; // in original mesh, i.e. the size of the materialproperties texture
    readonly materialProperties?: MaterialProperties;

    readonly modelWorldMatrix?: ReadonlyMat4; // model -> world space transformation matrix
    readonly subtrees?: ("terrain" | "triangles" | "lines" | "points")[];
    readonly variants?: ("deviation" | "intensity")[];
}

export async function downloadScene(url: string, abortController?: AbortController): Promise<RenderStateScene> {
    const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    if (!abortController)
        abortController = new AbortController();
    const { signal } = abortController;
    const baseUrl = new URL(url, scriptUrl);
    const config = (await download(new URL("config.json", baseUrl), "json", signal)) as OctreeSceneConfig;
    return { url: baseUrl.toString(), config } as const;
}

export function createSceneRootNode(context: RenderContext, config: OctreeSceneConfig) {
    const data = rootNodeData(config);
    return new OctreeNode(context, data);
}

function rootNodeData(config: OctreeSceneConfig): NodeData {
    const { version, rootByteSize, offset, scale, aabb, boundingSphere } = config;
    const bounds = { box: aabb, sphere: boundingSphere } as const;
    return {
        id: "",
        childIndex: 0,
        childMask: 1,
        tolerance: 0, // is this correct/fixed or do we need to put it into config?
        byteSize: rootByteSize,
        offset,
        scale,
        bounds,
        primitiveType: "TRIANGLES", // is this always the case?
        // config should probably contain SubMeshProjection data, suitable for aggregateSubMeshProjections()
        primitives: 0, // compute from config?
        gpuBytes: 0, // compute from config?
    };
}

async function download<T extends "arrayBuffer" | "json">(url: URL, kind: T, signal: AbortSignal) {
    const response = await fetch(url, { mode: "cors", signal });
    if (response.ok) {
        return (await response[kind]()) as T extends "arrayBuffer" ? ArrayBuffer : OctreeSceneConfig;
    } else {
        throw new Error(`HTTP Error:${response.status} ${response.status}`);
    }
}
