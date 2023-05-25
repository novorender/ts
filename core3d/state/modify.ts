
import { mat3, quat, vec3, type ReadonlyQuat, type ReadonlyVec3 } from "gl-matrix";
import type { RenderState, RenderStateCamera, RenderStateChanges, RenderStateClipping, RenderStateOutput } from ".";
import type { MutableCameraState } from "web_app/controller/base";

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

export function modifyRenderStateFromCadSpace(state: RenderState, changes: RenderStateChanges): RenderState {
    const { camera } = changes;
    if (camera) {
        const cameraChanges: MutableCameraState = {};
        const flipZY = quat.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);
        if (camera.position) {
            cameraChanges.position = vec3.transformQuat(vec3.create(), camera.position as vec3, flipZY);
        }
        if (camera.pivot) {
            cameraChanges.pivot = vec3.transformQuat(vec3.create(), camera.pivot as vec3, flipZY);
        }
        if (camera.rotation) {
            cameraChanges.rotation = quat.mul(quat.create(), flipZY, camera.rotation as quat);
        }
        changes = mergeRecursive(changes, { camera: cameraChanges });
    }
    return modifyRenderState(state, changes);
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
