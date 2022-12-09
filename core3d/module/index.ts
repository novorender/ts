import { DerivedRenderState } from "../state";
import { RenderContext } from "../context";
import { BackgroundModule } from "./background";
import { GridModule } from "./grid";
import { OctreeModule } from "./octree";
import { TonemapModule } from "./tonemap";
import { CubeModule } from "./cube";
import type { UniformTypes } from "@novorender/webgl2";

// constructor takes RenderState object
// this object contains all state (geometry, textures etc), or has at least the ability to reload state on demand if e.g. webgl context is lost
export interface RenderModule {
    withContext(context: RenderContext): RenderModuleContext | Promise<RenderModuleContext>;
    readonly uniforms: Record<string, UniformTypes>;
}

// contains module's GPU resources
export interface RenderModuleContext {
    update(state: DerivedRenderState): void;
    prepass?: () => void;
    render(): void;
    contextLost(): void;
    dispose(): void;
}

export function createDefaultModules() {
    return [
        new BackgroundModule(),
        new CubeModule(),
        new OctreeModule(),
        new GridModule(),
        new TonemapModule(),
    ];
}

export class RenderModuleState<T> {
    current: T | undefined;

    constructor(state?: T) {
        this.current = state;
    }

    hasChanged(state: T) {
        const { current } = this;
        let changed = false;
        // do a shallow comparison of root properties
        for (let prop in state) {
            if (!current || current[prop] !== state[prop]) {
                changed = true;
            }
        }
        if (changed) {
            this.current = state;
        }
        return changed;
    }
}

