import type { Core3DImports } from "./";
import type { WasmInstance } from "../";
import wasmURL from "../wasm/main.wasm";
import lutGGXUrl from "../lut_ggx.png";
import logoUrl from "../modules/watermark/logo.bin";
import { shaders } from "../shaders";
const loaderWorkerUrl = "loaderWorker.js";

async function download<T extends "text" | "json" | "blob" | "arrayBuffer" | "formData">(url: URL, kind: T) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`HTTP error ${response.status}: ${response.statusText}!`);
    return await (response[kind]() as ReturnType<Response[T]>);
}

async function createLutGGX(baseUrl: string) {
    const url = new URL(lutGGXUrl, baseUrl);
    const blob = await download(url, "blob");
    // const blob = new Blob([lut_ggx_png], { type: "image/png" });
    return await createImageBitmap(blob);
}

async function createInstance(baseUrl: string) {
    const url = new URL(wasmURL, baseUrl);
    const response = await fetch(url);
    const { instance } = await WebAssembly.instantiateStreaming(response);
    return instance.exports as unknown as WasmInstance;
}

function createWorker(baseUrl: string) {
    const url = new URL(loaderWorkerUrl, baseUrl);
    return new Worker(url, { type: "module", name: "loader" });
}

async function loadLogo(baseUrl: string) {
    const url = new URL(logoUrl, baseUrl);
    return await download(url, "arrayBuffer");
}

/** esbuild specific bundler imports
 * @category Render View
 */
export async function esbuildImports(baseUrl: string): Promise<Core3DImports> {
    const loaderWorker = createWorker(baseUrl);
    const lutGGXPromise = createLutGGX(baseUrl);
    const wasmInstancePromise = createInstance(baseUrl);
    const logoPromise = loadLogo(baseUrl);
    const [lutGGX, wasmInstance, logo] = await Promise.all([lutGGXPromise, wasmInstancePromise, logoPromise]);
    return { lutGGX, wasmInstance, loaderWorker, shaders, logo };
}
