/**
 *  Core3D bundler/build resource imports.
 * @remarks
 * In order to adapt to any build/bundler system and inlining preferences, we declare all non-javascript imported resources here.
 * These must be created by some external function that is specific to your build/bundler environment.
 * @category Render View
 */
export interface OfflineImports {
    /** The offline IO worker.
     * @remarks This worker root can be found in `offline/opfs/worker/index.js`.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker | Worker: Worker() constructor}
     */
    readonly ioWorker: Worker;
}


/**
 * A map describing inlined resources, or urls where to fetch them.
 */
export interface OfflineImportMap {
    /** The absolute base url to be applied to the other URLs.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL/URL}
     */
    readonly baseUrl: URL;

    /** Inlined io worker, or URL to download.
     * @defaultValue `"./ioWorker.js"`
     */
    readonly ioWorker?: string | URL;
}

/** Download any missing imports.
 * @param map URLs or bundled asset map.
 * @remarks
 * This function will attempt to download any resource not inlined from the specified urls,
 * using the specified {@link OfflineImportMap.baseUrl | baseUrl}.
 * If map is undefined, it will look for the files in the same folder as the current script.
 * 
 * @category Render View
 */
export async function downloadOfflineImports(map: OfflineImportMap): Promise<OfflineImports> {
    const { baseUrl } = map;
    const url = getWorkerUrl(map.ioWorker ?? "./ioWorker.js", baseUrl);
    const ioWorker = new Worker(url, { type: "module", name: "IO" });
    return { ioWorker };
}

function getWorkerUrl(arg: string | URL, baseUrl?: string | URL) {
    return new URL(arg, baseUrl);
}
