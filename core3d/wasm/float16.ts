import wasmCode from "./float16.wasm";

export interface Instance {
    float32(f16: number): number;
    float16(f32: number): number;
}

// from https://gist.github.com/zhuker/b4bd1fb306c7b04975b712c37c4c4075
export async function float16Instance() {
    const { instance } = await WebAssembly.instantiate(wasmCode);
    return instance.exports as unknown as Instance;
}

