import { RenderState, DerivedRenderState } from "../state";
import { RenderContext } from "../context";
import { BackgroundModule } from "./background";
import { GridModule } from "./grid";
import { CameraModule } from "./camera";
import { OctreeModule } from "./octree";
import { matricesFromRenderState } from "../matrices";
import { createViewFrustum } from "../viewFrustum";

// constructor takes RenderState object
// this object contains all state (geometry, textures etc), or has at least the ability to reload state on demand if e.g. webgl context is lost
export interface RenderModule {
    withContext(context: RenderContext): RenderModuleContext | Promise<RenderModuleContext>;
}

// contains module's GPU resources
export interface RenderModuleContext {
    render(state: DerivedRenderState): void;
    dispose(): void;
}

function createDerivedState(state: RenderState): DerivedRenderState {
    const matrices = matricesFromRenderState(state);
    const viewFrustum = createViewFrustum(state, matrices);
    return { ...state, matrices, viewFrustum };
}

export function createModules(state: RenderState) {
    const derivedState = createDerivedState(state);
    return [
        new CameraModule(derivedState),
        new BackgroundModule(derivedState),
        new GridModule(derivedState),
        new OctreeModule(derivedState),
    ]
}

export class RenderModuleState<T> {
    private _prevState: T | undefined;

    constructor(prevState?: T) {
        this._prevState = prevState;
    }

    hasChanged(state: T) {
        const { _prevState } = this;
        let changed = false;
        // do a shallow comparison of root properties
        for (let prop in state) {
            if (!_prevState || _prevState[prop] !== state[prop]) {
                changed = true;
            }
        }
        if (changed) {
            this._prevState = state;
        }
        return changed;
    }
}

