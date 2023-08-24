import type { WasmInstance } from "core3d";
import type { ShaderImports } from "core3d/shaders";
import type { TextureImageSource } from "webgl2";

/**
 *  Core3D bundler/build resource imports.
 * @remarks
 * In order to adapt to any build/bundler system and inlining preferences, we declare all non-javascript imported resources here.
 * These must be created by some external function that is specific to your build/bundler environment.
 * @category Render View
 */
export interface MeasureImports {
    /** The web assembly instance.
     * @remarks This web assembly can be found in `core3d/wasm/main.wasm`.
     * @see {@link https://developer.mozilla.org/en-US/docs/WebAssembly/Loading_and_running | Loading and running WebAssembly code}
     */
    readonly nurbsWasm: ArrayBuffer;

    /** The scene load/parse worker.
     * @remarks This worker root can be found in `core3d/modules/octree/worker/index.ts`.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker | Worker: Worker() constructor}
     */
    readonly measureWorker: URL;
}


/**
 * A map describing inlined resources, or urls where to fetch them.
 */
export interface MeasureImportMap {


    /** The base url to be applied to the other URLs.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL/URL}
 * @defaultValue `import.meta.url`
 */
    readonly baseUrl?: string | URL;
    /** Inlined WASM instance, or URL to download.
     * @defaultValue `"./main.wasm"`
     */
    readonly nurbsWasm?: string | URL | ArrayBuffer;

    /** Inlined loader worker, or URL to download.
     * @defaultValue `"./loaderWorker.js"`
     */
    readonly measureWorker?: string | URL;
}

/** Download any missing imports.
 * @param map URLs or bundled asset map.
 * @remarks
 * This function will attempt to download any resource not inlined from the specified urls,
 * using the specified {@link MeasureImportMap.baseUrl | baseUrl}.
 * If map is undefined, it will look for the files in the same folder as the current script.
 * 
 * @category Render View
 */
export async function downloadMeasureImports(map: MeasureImportMap): Promise<MeasureImports> {
    const baseUrl = new URL(map.baseUrl ?? "", import.meta.url);
    const measureWorker = getWorkerUrl(map.measureWorker ?? "./measureWorker.js", baseUrl);
    const wasmInstancePromise = getInstance(map.nurbsWasm ?? "./nurbs.wasm", baseUrl);
    const nurbsWasm = await wasmInstancePromise;
    return { nurbsWasm, measureWorker };
}

function isUrl(url: unknown): url is string | URL {
    return typeof url == "string" || url instanceof URL;
}

async function getInstance(arg: string | URL | ArrayBuffer, baseUrl?: string | URL) {
    if (!isUrl(arg)) {
        return arg;
    }
    const url = new URL(arg, baseUrl);
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
        throw new Error(`Could not download wasm instance from: ${url}`);
    }
    return await response.arrayBuffer();
    // const { instance } = await WebAssembly.instantiateStreaming(response);
    // return instance.exports as unknown as WasmInstance;
}

function getWorkerUrl(arg: string | URL, baseUrl?: string | URL) {
    return new URL(arg, baseUrl);
}
