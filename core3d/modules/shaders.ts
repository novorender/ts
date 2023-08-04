import background from "./background/shaders";
import clipping from "./clipping/shaders";
import cube from "./cube/shaders";
import dynamic from "./dynamic/shaders";
import grid from "./grid/shaders";
import octree from "./octree/shaders";
import tonemap from "./tonemap/shaders";
import toon from "./toon_outline/shaders";
import watermark from "./watermark/shaders";

/** @internal */
export type Shaders = { readonly [P in string]: { readonly vertexShader: string; readonly fragmentShader?: string; } };

/** @internal */
export const moduleShaders = {
    background, clipping, cube, dynamic, grid, octree, tonemap, toon, watermark
} as const satisfies { readonly [P in string]: Shaders }
