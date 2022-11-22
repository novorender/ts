import { RenderState } from "../state";
import { RenderContext } from "../context";
import { BackgroundModule } from "./background";
import { GridModule } from "./grid";
import { CameraModule } from "./camera";

// constructor takes RenderState object
// this object contains all state (geometry, textures etc), or has at least the ability to reload state on demand if e.g. webgl context is lost
export interface RenderModule {
    withContext(context: RenderContext): RenderModuleContext | Promise<RenderModuleContext>;
}

// contains module's GPU resources
export interface RenderModuleContext {
    render(state: RenderState): void;
    dispose(): void;
}

export function createModules(state: RenderState) {
    return [
        new CameraModule(state),
        new BackgroundModule(state),
        new GridModule(state),
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

