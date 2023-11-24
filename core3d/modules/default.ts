import { BackgroundModule } from "./background";
import { GridModule } from "./grid";
import { OctreeModule } from "./octree";
import { TonemapModule } from "./tonemap";
import { CubeModule } from "./cube";
import { ClippingModule } from "./clipping";
import { WatermarkModule } from "./watermark";
import { DynamicModule } from "./dynamic";
import { ToonModule } from "./toon_outline";

import { BackgroundModule as BackgroundModuleWebGPU } from "./background/webgpu";
import { TonemapModule as TonemapModuleWebGPU } from "./tonemap/webgpu";
import { GridModule as GridModuleWebGPU } from "./grid/webgpu";
import { CubeModule as CubeModuleWebGPU } from "./cube/webgpu";

/** Return the default/built-in render modules in the order they should be rendered.
 * @category Render Module
 */
export function createDefaultModules() {
    return [
        new BackgroundModule(),
        new CubeModule(),
        new OctreeModule(),
        new DynamicModule(),
        new ToonModule(),
        new GridModule(),
        new ClippingModule(),
        new WatermarkModule(),
        new TonemapModule(),
    ];
}


/** Return the default/built-in render modules in the order they should be rendered.
 * @category Render Module
 */
export function createDefaultModulesWebGPU() {
    return [
        new BackgroundModuleWebGPU(),
        new GridModuleWebGPU(),
        new CubeModuleWebGPU(),
        new DynamicModuleWebGPU(),
        new TonemapModuleWebGPU(),
    ];
}