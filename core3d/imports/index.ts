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
export interface Core3DImports {
    /** The GGX shader lookup image.
     * @remarks This image can be found in `core3d/lut_ggx.png`.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CreateImageBitmap | createImageBitmap}
     */
    readonly lutGGX: TextureImageSource;

    /** The web assembly instance.
     * @remarks This web assembly can be found in `core3d/wasm/main.wasm`.
     * @see {@link https://developer.mozilla.org/en-US/docs/WebAssembly/Loading_and_running | Loading and running WebAssembly code}
     */
    readonly wasmInstance: WasmInstance;

    /** The web assembly instance.
     * @remarks This web assembly can be found in `@novorender/wasm-parser/wasm_parser_bg.wasm`.
     * @see {@link https://developer.mozilla.org/en-US/docs/WebAssembly/Loading_and_running | Loading and running WebAssembly code}
     */
    readonly parserWasm: ArrayBuffer;

    /** The scene load/parse worker.
     * @remarks This worker root can be found in `core3d/modules/octree/worker/index.ts`.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker | Worker: Worker() constructor}
     */
    readonly loaderWorker: Worker;

    /** The watermark logo data.
     * @remarks This file can be found in `core3d/modules/watermark/logo.bin`.
     */
    readonly logo: ArrayBuffer;

    /** GLSL shader imports.
     * @remarks The shaders can be found in `core3d/imports/shaders.ts`.
     */
    readonly shaders: ShaderImports;
}


/**
 * A map describing inlined resources, or urls where to fetch them.
 */
export interface Core3DImportMap {
    /** The base url to be applied to the other URLs.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL/URL}
     */
    readonly baseUrl: URL;

    /** Inlined GGX lookup texture as Blob or ImageBitmap, or URL to download.
     * @defaultValue `"./lut_ggx.png"`
     * @remarks Blobs should have their type set to the proper MIME type, e.g. `type: "image/png"`.
     */
    readonly lutGGX?: string | URL | Blob | ImageBitmap;

    /** Inlined WASM instance, or URL to download.
     * @defaultValue `"./main.wasm"`
     */
    readonly wasmInstance?: string | URL | WasmInstance;

    /** Inlined WASM data, or URL to download.
     * @defaultValue `"./parser.wasm"`
     */
    readonly parserWasm?: string | URL | ArrayBuffer;

    /** Inlined loader worker, or URL to download.
     * @defaultValue `"./loaderWorker.js"`
     */
    readonly loaderWorker?: string | URL | Worker;

    /** Inlined Logo, or URL to download.
     * @defaultValue `"./logo.bin"`
     */
    readonly logo?: string | URL | ArrayBuffer;

    /** Inlined shaders, or URL to download.
     * @defaultValue `"./shaders.js"`
     */
    readonly shaders?: string | URL | ShaderImports;
}

/** Download any missing imports.
 * @param map URLs or bundled asset map.
 * @remarks
 * This function will attempt to download any resource not inlined from the specified urls,
 * using the specified {@link Core3DImportMap.baseUrl | baseUrl}.
 * If map is undefined, it will look for the files in the same folder as the current script.
 *
 * @category Render View
 */
export async function downloadCore3dImports(map: Core3DImportMap): Promise<Core3DImports> {
    const { baseUrl } = map;
    const loaderWorker = getWorker(map.loaderWorker ?? "./loaderWorker.js", baseUrl);
    const lutGGXPromise = getLutGGX(map.lutGGX ?? "./lut_ggx.png", baseUrl);
    const wasmInstancePromise = getInstance(map.wasmInstance ?? "./main.wasm", baseUrl);
    const parserWasmPromise = getArrayBuffer(map.parserWasm ?? "./parser.wasm", baseUrl);
    const shadersPromise = getShaders(map.shaders ?? "./shaders.js", baseUrl);
    const logoPromise = getLogo(map.logo ?? "./logo.bin", baseUrl);
    const [lutGGX, wasmInstance, parserWasm, shaders, logo] =
        await Promise.all([lutGGXPromise, wasmInstancePromise, parserWasmPromise, shadersPromise, logoPromise]);
    return { lutGGX, wasmInstance, parserWasm, loaderWorker, shaders, logo };
}

async function download<T extends "text" | "json" | "blob" | "arrayBuffer" | "formData">(url: URL, kind: T) {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok)
        throw new Error(`HTTP error ${response.status}: ${response.statusText}!`);
    return await (response[kind]() as ReturnType<Response[T]>);
}

function isUrl(url: unknown): url is string | URL {
    return typeof url == "string" || url instanceof URL;
}

async function getLutGGX(arg: string | URL | Blob | ImageBitmap, baseUrl?: string | URL) {
    let blob: Blob | undefined;
    if (isUrl(arg)) {
        const url = new URL(arg, baseUrl);
        blob = await download(url, "blob");
    } else if (arg instanceof Blob) {
        blob = arg;
    } else {
        return arg;
    }
    return await createImageBitmap(blob);
}

async function getInstance(arg: string | URL | WasmInstance, baseUrl?: string | URL) {
    if (!isUrl(arg)) {
        return arg;
    }
    const url = new URL(arg, baseUrl);
    const response = await fetch(url, { mode: "cors" });
    const { instance } = await WebAssembly.instantiateStreaming(response);
    return instance.exports as unknown as WasmInstance;
}

async function getArrayBuffer(arg: string | URL | ArrayBuffer, baseUrl?: string | URL) {
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

function getWorker(arg: string | URL | Worker, baseUrl?: string | URL) {
    if (!isUrl(arg)) {
        return arg;
    }
    const url = new URL(arg, baseUrl);
    return new Worker(url, { type: "module", name: "loader" });
}

async function getLogo(arg: string | URL | ArrayBuffer, baseUrl?: string | URL) {
    if (!isUrl(arg)) {
        return arg;
    }
    const url = new URL(arg, baseUrl);
    return await download(url, "arrayBuffer");
}

async function getShaders(arg: string | URL | ShaderImports, baseUrl?: string | URL) {
    if (!isUrl(arg)) {
        return arg;
    }
    const url = new URL(arg, baseUrl);
    const { shaders } = await import( /* webpackIgnore: true */ url.toString());
    return shaders as ShaderImports;
}
