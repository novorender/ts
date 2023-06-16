import type { SceneConfig, RenderStateScene } from ".";
import { NodeType, type NodeData } from "./modules/octree/parser";
import { OctreeNode, type OctreeContext, NodeGeometryKind, NodeState } from "./modules/octree/node";
import type { RootNodes } from "./modules/octree";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export async function downloadScene(url: string, abortController?: AbortController): Promise<RenderStateScene> {
    if (!abortController)
        abortController = new AbortController();
    const { signal } = abortController;
    const fullUrl = new URL(url);
    fullUrl.pathname += "config.json";
    const config = (await download(fullUrl, "json", signal)) as SceneConfig;
    return { url: url.toString(), config } as const;
}

export async function createSceneRootNodes(context: OctreeContext, config: SceneConfig): Promise<RootNodes | undefined> {
    const data = rootNodeData(config);
    // const subtrees = config.subtrees?.map((st, i) => ([st, i] as const))?.filter(([st]) => st.length > 0) ?? [["triangles", NodeGeometryKind.triangles]];
    let root = new OctreeNode(context, data, undefined);
    const rootNodes: Mutable<RootNodes> = {};
    await root.downloadNode(false);
    root = root.children[0];
    if (!root)
        return undefined;
    await root.downloadNode(false); // extract subtrees
    const promises: Promise<void>[] = [];
    for (var child of root.children) {
        rootNodes[child.data.childIndex as keyof RootNodes] = child;
        const promise = child.downloadNode();
        promises.push(promise);
    }
    await Promise.all(promises);
    for (child of root.children) {
        if (child.state != NodeState.ready) {
            return undefined;
        }
    }
    const hasNodes = Object.getOwnPropertyNames(rootNodes).length > 0;
    return hasNodes ? rootNodes : undefined;
}

function rootNodeData(config: SceneConfig): NodeData {
    const { version, rootByteSize, offset, scale, aabb, boundingSphere } = config;
    const bounds = { box: aabb, sphere: boundingSphere } as const;
    return {
        id: "",
        childIndex: 0,
        childMask: 1,
        type: NodeType.Mixed,
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
        return (await response[kind]()) as T extends "arrayBuffer" ? ArrayBuffer : SceneConfig;
    } else {
        throw new Error(`HTTP Error:${response.status} ${response.status}`);
    }
}
