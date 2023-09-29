import type * as WasmNamespace from "@novorender/wasm-parser";
// @ts-ignore
import * as wasmWrapper from "@novorender/wasm-parser/wasm_parser_bg";

export type WasmInstance = typeof WasmNamespace;

/** @internal */
export async function esbuildWasmInstance(wasmData: ArrayBuffer): Promise<WasmInstance> {
    let imports = {
        ["./wasm_parser_bg.js"]: wasmWrapper,
    };
    const { instance } = await WebAssembly.instantiate(wasmData, imports);
    wasmWrapper.__wbg_set_wasm(instance.exports);
    return wasmWrapper;
}