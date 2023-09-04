import type { SceneConfig, RenderState, RenderStateScene, DeviceProfile } from ".";
import { OctreeNode, type OctreeContext, NodeGeometryKind } from "./modules/octree/node";
import type { RootNodes } from "./modules/octree";
import { decodeBase64 } from "./util";
import { isSupportedVersion } from "./modules/octree";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Download scene from url.
 * @param url Url of scene Root folder, e.g. `https://blobs.novorender.com/<sceneid>/`
 * @param abortSignal Optional abort signal.
 * @returns A render state scene ready to be assign to {@link RenderState.scene}.
 * @remarks
 * The loaded state does not contain any geometry, only the data required to start geometry streaming.
 * It may take several frames for any geometry to appear, and several seconds for it to fully resolve.
 * @category Render State
 */
export async function downloadScene(url: string, abortSignal?: AbortSignal): Promise<RenderStateScene> {
    const fullUrl = new URL(url);
    fullUrl.pathname += "scene.json";
    const config = (await download(fullUrl, "json", abortSignal)) as SceneConfig;
    if (!isSupportedVersion(config.version)) {
        throw new Error(`Unsupported scene version: ${config.variants}!`);
    }
    return { url: url.toString(), config } as const;
}

/** @internal */
export async function createSceneRootNodes(context: OctreeContext, config: SceneConfig, deviceProfile: DeviceProfile): Promise<RootNodes | undefined> {
    const { buffer } = decodeBase64(config.root);
    const { loader } = context;
    const result = await loader.parseNode(buffer, "", deviceProfile, config.version);
    if (!result)
        return;
    const { childInfos } = result;
    const rootNodes: Mutable<RootNodes> = {};
    let hasNodes = false;
    for (const childInfo of childInfos) {
        const geometryKind = childInfo.childIndex as NodeGeometryKind;
        const child = new OctreeNode(context, childInfo, geometryKind);
        rootNodes[childInfo.childIndex as keyof RootNodes] = child;
        hasNodes = true;
    }
    return hasNodes ? rootNodes : undefined;
}

async function download<T extends "arrayBuffer" | "json">(url: URL, kind: T, signal?: AbortSignal) {
    const response = await fetch(url, { mode: "cors", signal });
    if (response.ok) {
        return (await response[kind]()) as T extends "arrayBuffer" ? ArrayBuffer : SceneConfig;
    } else {
        throw new Error(`HTTP Error:${response.status} ${response.status}`);
    }
}
