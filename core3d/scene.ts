import type { SceneConfig, RenderStateScene, DeviceProfile } from ".";
import { OctreeNode, type OctreeContext, NodeState, NodeGeometryKind } from "./modules/octree/node";
import type { RootNodes } from "./modules/octree";
import { decodeBase64 } from "./util";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export async function downloadScene(url: string, abortController?: AbortController): Promise<RenderStateScene> {
    if (!abortController)
        abortController = new AbortController();
    const { signal } = abortController;
    const fullUrl = new URL(url);
    fullUrl.pathname += "scene.json";
    const config = (await download(fullUrl, "json", signal)) as SceneConfig;
    console.assert(config.version == "2.0");
    return { url: url.toString(), config } as const;
}

export async function createSceneRootNodes(context: OctreeContext, config: SceneConfig, deviceProfile: DeviceProfile): Promise<RootNodes | undefined> {
    const { buffer } = decodeBase64(config.root);
    const { loader } = context;
    const result = await loader.parseNode(buffer, "", deviceProfile, config.version);
    if (!result)
        return;
    const { childInfos } = result;
    const rootNodes: Mutable<RootNodes> = {};
    const promises: Promise<void>[] = [];
    const children: OctreeNode[] = [];
    for (const childInfo of childInfos) {
        const geometryKind = childInfo.childIndex as NodeGeometryKind;
        const child = new OctreeNode(context, childInfo, geometryKind);
        rootNodes[childInfo.childIndex as keyof RootNodes] = child;
        const promise = child.downloadNode();
        promises.push(promise);
        children.push(child);
    }
    await Promise.all(promises);
    for (const child of children) {
        if (child.state != NodeState.ready) {
            return undefined;
        }
    }
    const hasNodes = Object.getOwnPropertyNames(rootNodes).length > 0;
    return hasNodes ? rootNodes : undefined;
}

async function download<T extends "arrayBuffer" | "json">(url: URL, kind: T, signal: AbortSignal) {
    const response = await fetch(url, { mode: "cors", signal });
    if (response.ok) {
        return (await response[kind]()) as T extends "arrayBuffer" ? ArrayBuffer : SceneConfig;
    } else {
        throw new Error(`HTTP Error:${response.status} ${response.status}`);
    }
}
