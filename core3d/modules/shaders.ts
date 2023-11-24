import background from "./background/shaders";
import clipping from "./clipping/shaders";
import cube from "./cube/shaders";
import dynamic from "./dynamic/shaders";
import grid from "./grid/shaders";
import octree from "./octree/shaders";
import tonemap from "./tonemap/shaders";
import toon from "./toon_outline/shaders";
import watermark from "./watermark/shaders";


import { shadersWGSL as tonemapWGSL } from "./tonemap/shaders";
import { shadersWGSL as gridWGSL } from "./grid/shaders";
import { shadersWGSL as backgroundWGSL } from "./background/shaders";
import { shadersWGSL as cubeWGSL } from "./cube/shaders";
import { shadersWGSL as dynamicWGSL } from "./dynamic/shaders";

/** @internal */
export type Shaders = { readonly [P in string]: { readonly vertexShader: string; readonly fragmentShader?: string; } };

/** @internal */
export const moduleShaders = {
    background, clipping, cube, dynamic, grid, octree, tonemap, toon, watermark
} as const satisfies { readonly [P in string]: Shaders }

/** @internal */
export type ShadersWGSL = { readonly [P in string]: { readonly shader: string } };

/** @internal */
export const moduleShadersWGSL = {
    tonemap: tonemapWGSL,
    grid: gridWGSL,
    background: backgroundWGSL,
    cube: cubeWGSL,
    dynamic: dynamicWGSL,
    /*clipping, grid, octree, toon, watermark*/
} as const satisfies { readonly [P in string]: ShadersWGSL }
