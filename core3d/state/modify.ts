
import { mat3, quat, vec3, type ReadonlyQuat, type ReadonlyVec3, vec4, type ReadonlyVec4 } from "gl-matrix";
import type { RecursivePartial, RenderState, RenderStateCamera, RenderStateChanges, RenderStateClipping, RenderStateClippingPlane, RenderStateGrid, RenderStateOutput } from ".";
import type { MutableCameraState } from "web_app/controller/base";
import type { RGBA } from "webgl2";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
export type MutableGridState = Partial<Mutable<RenderStateGrid>>;

// this function will create a copy where unchanged properties have same identity (=== operator yields true)
// use this to quickly check for changes.
export function modifyRenderState(state: RenderState, changes: RenderStateChanges): RenderState {
    const newState = mergeRecursive(state, changes) as RenderState;
    if (changes.output) {
        verifyOutputState(newState.output);
    }
    if (changes.clipping) {
        verifyClippingState(newState.clipping);
    }
    return newState;
}

export function mergeRecursive(original: any, changes: any) {
    const clone = { ...original };
    for (const key in changes) {
        const originalValue = original ? original[key] : undefined;
        const changedValue = changes[key];
        if (changedValue != undefined && typeof changedValue == "object" && !Array.isArray(changedValue)) {
            clone[key] = mergeRecursive(originalValue, changedValue);
        } else {
            clone[key] = changedValue;
        }
    }
    return clone;
}

function verifyOutputState(state: RenderStateOutput) {
    const { width, height } = state;
    if (!Number.isInteger(width) || !Number.isInteger(height))
        throw new Error(`Output size dimentions (width:${width}, height:${height}) must be integers!`);
}

function verifyClippingState(state: RenderStateClipping) {
    const { planes } = state;
    if (planes.length > 6)
        throw new Error(`A maximum of six clippings planes are allowed!`);
}
