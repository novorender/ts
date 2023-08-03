import common from "./common.glsl"; // common/shaderd glsl code for all shaders.
import { shaders as benchmark } from "./benchmark/shaders"; // common/shaderd glsl code for all shaders.
import { moduleShaders } from "./modules/shaders";

/** @internal */
export const shaders = {
    common, benchmark, ...moduleShaders
} as const;

/** Standard module glsl shader imports. */
export type ShaderImports = typeof shaders;
