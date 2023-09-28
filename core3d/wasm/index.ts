// import { type Float16Instance } from "./float16";
import type * as WasmNamespace from "@novorender/wasm";

type WasmModuleType = typeof WasmNamespace;

/** The web assembly instance used by the render context. */
export type WasmInstance = Omit<{ [P in keyof WasmModuleType]: WasmModuleType[P] }, "default">;

// export interface WasmInstance extends Float16Instance {
// }