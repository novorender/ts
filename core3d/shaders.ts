import common from "./common.glsl"; // common/shaderd glsl code for all shaders.
import { shaders as benchmark } from "./benchmark/shaders"; // common/shaderd glsl code for all shaders.
import { moduleShaders, moduleShadersWGSL } from "./modules/shaders";

/** @internal */
export const shaders = {
    common, benchmark, ...moduleShaders
} as const;

/** @internal */
export const shadersWGSL = {
    ...moduleShadersWGSL
} as const;

/** Standard module glsl shader imports.
 * @category Render Module
 */
export type ShaderImports = typeof shaders;

/** Standard module glsl shader imports.
 * @category Render Module
 */
export type ShaderImportsWGSL = typeof shadersWGSL;
