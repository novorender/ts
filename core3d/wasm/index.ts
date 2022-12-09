import { float16Instance } from "./float16";

export async function wasmInstance() {
    const float16 = await float16Instance();
    // other modules here...
    const instance = { ...float16 };
    return instance;
}

export type WasmInstance = Awaited<ReturnType<typeof wasmInstance>>;