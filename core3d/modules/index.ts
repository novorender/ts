import type { DerivedRenderState } from "../state";
import { RenderContext } from "../context";
import { BackgroundModule } from "./background";
import { GridModule } from "./grid";
import { OctreeModule } from "./octree";
import { TonemapModule } from "./tonemap";
import { CubeModule } from "./cube";
import { ClippingModule } from "./clipping";
import { WatermarkModule } from "./watermark";
import { DynamicModule } from "./dynamic";

// contains all state (geometry, textures etc), or has at least the ability to reload state on demand if e.g. webgl context is lost
export interface RenderModule {
    readonly kind: string;
    withContext(context: RenderContext): RenderModuleContext | Promise<RenderModuleContext>;
}

// contains module's GPU resources
export interface RenderModuleContext {
    readonly module: RenderModule;
    update(state: DerivedRenderState): void;
    readonly prepass?: (state: DerivedRenderState) => void;
    readonly pick?: (state: DerivedRenderState) => void;
    render(state: DerivedRenderState): void;
    contextLost(): void;
    dispose(): void;
}

export function createDefaultModules() {
    return [
        new BackgroundModule(),
        new CubeModule(),
        new OctreeModule(),
        new DynamicModule(),
        new GridModule(),
        new ClippingModule(),
        new WatermarkModule(),
        new TonemapModule(),
    ];
}
