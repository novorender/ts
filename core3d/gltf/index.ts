import { loadData } from "./loader";
import { parseGLTF } from "./parser";

export async function loadGLTF(url: URL, baseObjectId?: number, abortController?: AbortController) {
    const { gltf, buffers, externalImageBlobs } = await loadData(url, abortController);
    return parseGLTF(buffers, gltf, externalImageBlobs, baseObjectId);
}