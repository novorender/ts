import { quat, ReadonlyQuat, ReadonlyVec3, vec3 } from "gl-matrix";

export type RGBA = readonly [red: number, green: number, blue: number, alpha: number];

export interface RenderStateOutput {
    readonly width: number;
    readonly height: number;
}

export interface RenderStateBackground {
    readonly color: RGBA;
}

export interface RenderStateCamera {
    readonly kind: "pinhole" | "orthographic";
    readonly position: ReadonlyVec3;
    readonly rotation: ReadonlyQuat;
    readonly fov: number;
    readonly front: number;
    readonly back: number;
}

export interface RenderStateGrid {
    readonly color: RGBA;
    readonly origin: ReadonlyVec3;
    readonly axisX: ReadonlyVec3;
    readonly axisY: ReadonlyVec3;
    readonly size: number; // integer dimension
    readonly spacing: number; // spacing between each cell
}

export interface RenderState {
    readonly output: RenderStateOutput;
    readonly background: RenderStateBackground;
    readonly camera: RenderStateCamera;
    readonly grid: RenderStateGrid;
}

type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
};

export type RenderStateChanges = RecursivePartial<RenderState>;

// this function will create a copy where unchanged properties have same identity (=== operator yields true)
// use this to quickly check for changes.
export function modifyRenderState(state: RenderState, changes: RenderStateChanges): RenderState {
    return mergeRecursive(state, changes) as RenderState;
    // return { ...state, ...changes as RenderState };
}

function mergeRecursive(original: any, changes: any) {
    const clone: any = {};
    for (const key in original) {
        const originalValue = original[key];
        const changedValue = changes[key];
        if (key in changes) {
            if (changedValue && typeof changedValue == "object" && !Array.isArray(changedValue)) {
                clone[key] = mergeRecursive(originalValue, changedValue);
            } else {
                clone[key] = changedValue;
            }
        } else {
            clone[key] = originalValue;
        }
    }
    return clone;
}

export function defaultRenderState(): RenderState {
    return {
        output: {
            width: 512,
            height: 256,
        },
        background: {
            color: [0, 0, 0.25, 1],
        },
        camera: {
            kind: "pinhole",
            position: vec3.create(),
            rotation: quat.create(),
            fov: 45,
            front: 0.1,
            back: 1000,
        },
        grid: {
            color: [1, 1, 1, 1],
            origin: [0, 0, 0],
            axisX: [1, 0, 0],
            axisY: [0, 1, 0],
            size: 10,
            spacing: 1,
        },
    };
}
