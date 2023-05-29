
import { mat3, quat, vec3, type ReadonlyQuat, type ReadonlyVec3, vec4, type ReadonlyVec4 } from "gl-matrix";
import type { RenderState, RenderStateCamera, RenderStateChanges, RenderStateClipping, RenderStateClippingPlane, RenderStateGrid, RenderStateOutput } from ".";
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

export function modifyRenderStateFromCadSpace(state: RenderState, changes: RenderStateChanges): RenderState {
    const { camera, grid, clipping, outlines } = changes;
    const flipZY = quat.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);
    if (camera) {
        const c = camera as RenderStateCamera;
        const cameraChanges: MutableCameraState = {};
        if (c.position) {
            cameraChanges.position = vec3.transformQuat(vec3.create(), c.position, flipZY);
        }
        if (c.pivot) {
            cameraChanges.pivot = vec3.transformQuat(vec3.create(), c.pivot, flipZY);
        }
        if (c.rotation) {
            cameraChanges.rotation = quat.mul(quat.create(), flipZY, c.rotation);
        }
        changes = mergeRecursive(changes, { camera: cameraChanges });
    }
    if (grid) {
        const g = grid as RenderStateGrid;
        const gridChanges: MutableGridState = {};
        if (g.axisX) {
            gridChanges.axisX = vec3.transformQuat(vec3.create(), g.axisX, flipZY);
        }
        if (g.axisY) {
            gridChanges.axisY = vec3.transformQuat(vec3.create(), g.axisY, flipZY);
        }
        if (g.origin) {
            gridChanges.origin = vec3.transformQuat(vec3.create(), g.origin, flipZY);
        }
        changes = mergeRecursive(changes, { grid: gridChanges });
    }
    if (clipping && clipping.planes) {
        const flippedPlanes: RenderStateClippingPlane[] = [];
        for (const plane of clipping.planes) {
            if (plane) {
                const p = plane as RenderStateClippingPlane;
                const { normalOffset } = p;
                if (normalOffset) {
                    flippedPlanes.push({
                        normalOffset: vec4.fromValues(normalOffset[0], normalOffset[2], -normalOffset[1], normalOffset[3]),
                        color: p.color ?? undefined
                    });
                }
            }
        }
        changes = mergeRecursive(changes, { clipping: { planes: flippedPlanes } });
    }
    if (outlines && outlines.plane) {
        const p = outlines.plane as ReadonlyVec4;
        changes = mergeRecursive(changes, { outlines: { plane: vec4.fromValues(p[0], p[2], -p[1], p[3]) } });
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
