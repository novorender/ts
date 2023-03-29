import type { OctreeSceneConfig, RenderStateScene } from ".";
import type { NodeData } from "./modules/octree/parser";
import { OctreeNode, type OctreeContext } from "./modules/octree/node";


export async function downloadScene(url: string, abortController?: AbortController): Promise<RenderStateScene> {
    const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    if (!abortController)
        abortController = new AbortController();
    const { signal } = abortController;
    const baseUrl = new URL(url, scriptUrl);
    const config = (await download(new URL("config.json", baseUrl), "json", signal)) as OctreeSceneConfig;
    return { url: baseUrl.toString(), config } as const;
}

export function createSceneRootNode(context: OctreeContext, config: OctreeSceneConfig) {
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
        tolerance: 0,
        nodeSize: 0,
        byteSize: rootByteSize,
        offset,
        scale,
        bounds,
        // config should probably contain SubMeshProjection data, suitable for aggregateSubMeshProjections()
        primitives: 0, // compute from config?
        primitivesDelta: 0, // same as primitives above
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
