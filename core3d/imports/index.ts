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
