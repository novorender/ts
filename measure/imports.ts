/**
 *  Core3D bundler/build resource imports.
 * @remarks
 * In order to adapt to any build/bundler system and inlining preferences, we declare all non-javascript imported resources here.
 * These must be created by some external function that is specific to your build/bundler environment.
 * @category Render View
 */
export interface MeasureImports {
    /** The nurbs web assembly instance.
     * @remarks This web assembly can be found in `measure/nurbs.wasm`.
     * @see {@link https://developer.mozilla.org/en-US/docs/WebAssembly/Loading_and_running | Loading and running WebAssembly code}
     */
    readonly nurbsWasm: ArrayBuffer;

    /** The  measure load/parse worker.
     * @remarks This worker root can be found in `measure/measureWorker.js`.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker | Worker: Worker() constructor}
     */
    readonly measureWorker: URL;
}


/**
 * A map describing inlined resources, or urls where to fetch them.
 */
export interface MeasureImportMap {
    /** The absolute base url to be applied to the other URLs.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL/URL}
     */
    readonly baseUrl: URL;
    /** Inlined WASM instance, or URL to download.
     * @defaultValue `"./nurbs.wasm"`
     */
    readonly nurbsWasm?: string | URL | ArrayBuffer;

    /** Inlined measure worker, or URL to download.
     * @defaultValue `"./measureWorker.js"`
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
    const { baseUrl } = map;
    const measureWorker = getWorkerUrl(map.measureWorker ?? "/measureWorker.js", baseUrl);
    const wasmInstancePromise = getInstance(map.nurbsWasm ?? "/nurbs.wasm", baseUrl);
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
    const url = appendPath(arg, baseUrl);
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) {
        throw new Error(`Could not download wasm instance from: ${url}`);
    }
    return await response.arrayBuffer();
    // const { instance } = await WebAssembly.instantiateStreaming(response);
    // return instance.exports as unknown as WasmInstance;
}

function getWorkerUrl(arg: string | URL, baseUrl?: string | URL) {
    return appendPath(arg, baseUrl);
}


/** @internal */
function appendPath(arg: string | URL, baseUrl?: string | URL) {
    const url = new URL(baseUrl ?? arg);
    if (baseUrl) {
        url.pathname += arg;
    }
    return url;
}