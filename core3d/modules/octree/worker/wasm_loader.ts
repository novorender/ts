import type * as WasmNamespace from "@novorender/wasm-parser";
// @ts-ignore
import wasmUrl from "@novorender/wasm-parser/wasm_parser_bg.wasm"; // file loader
// @ts-ignore
import * as wasmWrapper from "@novorender/wasm-parser/wasm_parser_bg";

export type WasmInstance = typeof WasmNamespace;

/** @internal */
export async function esbuildWasmInstance(baseUrl?: string | URL): Promise<WasmInstance> {
    baseUrl ??= import.meta.url;
    const wasm = wasmUrl as unknown as string;
    const url = new URL(wasm,  new URL(baseUrl, import.meta.url));
    const response = await fetch(url, { mode: "cors" });
    let imports = {
        ["./wasm_parser_bg.js"]: wasmWrapper,
    };
    const { instance } = await WebAssembly.instantiateStreaming(response, imports);
    wasmWrapper.__wbg_set_wasm(instance.exports);
    return wasmWrapper;
}