import { BackgroundModule } from "./background";
import { GridModule } from "./grid";
import { OctreeModule } from "./octree";
import { TonemapModule } from "./tonemap";
import { CubeModule } from "./cube";
import { ClippingModule } from "./clipping";
import { WatermarkModule } from "./watermark";
import { DynamicModule } from "./dynamic";
import { ToonModule } from "./toon_outline";

/** Return the default/built-in render modules in the order they should be rendered.
 * @category Render Module
 */
export function createDefaultModules() {
    return [
        new BackgroundModule(),
        new CubeModule(),
        new ClippingModule(),
        new OctreeModule(),
        new DynamicModule(),
        new ToonModule(),
        new GridModule(),
        new WatermarkModule(),
        new TonemapModule(),
    ];
}
