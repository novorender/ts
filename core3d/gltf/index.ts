import type { RenderState } from "../";
import { loadData } from "./loader";
import { parseGLTF } from "./parser";

/**
 * Load a {@link https://www.khronos.org/gltf/ | gltf} file from url.
 * @param url Url to gltf or glb file.
 * @param baseObjectId The base (start) object id to assign to the loaded object for picking.
 * @param abortController Optional abort controller.
 * @returns An array of dynamic render state objects ready to be assigned to {@link RenderState.dynamic}.
 * @remarks
 * Only a subset of the features in {@link https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html | glTF2} specs are supported.
 * More specifically, unsupported features are:
 * 
 * {@link https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-accessor-sparse | Sparse accessors}
 * 
 * {@link https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-animation | Animation}
 * 
 * {@link https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-camera | Camera}
 * 
 * {@link https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#reference-skin | Skin}
 * 
 * Currently the only extensions supported is {@link https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_unlit/README.md | KHR_materials_unlit}.
 * @category Geometry
 */
export async function loadGLTF(url: URL, baseObjectId?: number, abortController?: AbortController) {
    const { gltf, buffers, externalImageBlobs } = await loadData(url, abortController);
    return parseGLTF(buffers, gltf, externalImageBlobs, baseObjectId);
}