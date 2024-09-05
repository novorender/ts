import type { SceneConfig, RenderState, RenderStateScene, DeviceProfile } from ".";
import { OctreeNode, type OctreeContext, NodeGeometryKind } from "./modules/octree/node";
import type { RootNodes } from "./modules/octree";
import { decodeBase64 } from "./util";
import { isSupportedVersion } from "./modules/octree";
import { vec3, type ReadonlyVec3 } from "gl-matrix";
import { requestOfflineFile } from "offline/file";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/**
 * Download scene from url.
 * @param baseUrl Url of the containing folder, e.g. `https://blobs.novorender.com/<sceneid>/`
 * @param configPath The relative path to the scene json file, e.g. `webgl2_bin/<scenehash>`
 * @param abortSignal Optional abort signal.
 * @returns A render state scene ready to be assigned to {@link RenderState.scene}.
 * @remarks
 * The loaded state does not contain any geometry, only the data required to start geometry streaming.
 * It may take several frames for any geometry to appear, and several seconds for it to fully resolve.
 * @category Render State
 */
export async function downloadScene(baseUrl: URL, configPath: string, abortSignal?: AbortSignal): Promise<RenderStateScene> {
    const url = new URL(baseUrl);
    url.pathname += configPath;
    let config = (await download(url, "json", abortSignal)) as SceneConfig;
    if (config.up) {
        // for now we assume that the presence of an up vector means cad-space.
        // until every scene is in cad space, we rotate it back into gl-space for backward compatibility.
        const { offset, center, boundingSphere, aabb } = config;
        config = {
            ...config,
            offset: flipCADToGLVec(offset),
            center: flipCADToGLVec(center),
            boundingSphere: {
                radius: boundingSphere.radius,
                center: flipCADToGLVec(boundingSphere.center)
            },
            aabb: {
                min: flipCADToGLVec(aabb.min),
                max: flipCADToGLVec(aabb.max),
            }
        };
    }
    if (!isSupportedVersion(config.version)) {
        throw new Error(`Unsupported scene version: ${config.version}!`);
    }
    return { url: baseUrl.toString(), config } as const;
}

function flipCADToGLVec(v: ReadonlyVec3): ReadonlyVec3 {
    const [x, y, z] = v;
    return vec3.fromValues(x, z, -y);
}

/** @internal */
export async function createSceneRootNodes(context: OctreeContext, config: SceneConfig, deviceProfile: DeviceProfile): Promise<RootNodes | undefined> {
    const { buffer } = decodeBase64(config.root);
    const { loader } = context;
    const result = await loader.parseNode(buffer, "", deviceProfile, config);
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
    const request = new Request(url, { mode: "cors", signal });
    const response = await requestOfflineFile(request) ?? await fetch(request);
    if (response.ok) {
        return (await response[kind]()) as T extends "arrayBuffer" ? ArrayBuffer : SceneConfig;
    } else {
        throw new Error(`HTTP Error:${response.status} ${response.status}`);
    }
}
