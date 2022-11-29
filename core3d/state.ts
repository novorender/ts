import { quat, vec3, ReadonlyQuat, ReadonlyVec3, ReadonlyVec4, ReadonlyMat4, ReadonlyMat3 } from "gl-matrix";
import { OctreeSceneConfig } from "./scene";

export type RGBA = readonly [red: number, green: number, blue: number, alpha: number];

export interface ViewFrustum {
    readonly left: ReadonlyVec4;
    readonly right: ReadonlyVec4;
    readonly top: ReadonlyVec4;
    readonly bottom: ReadonlyVec4;
    readonly near: ReadonlyVec4;
    readonly far: ReadonlyVec4;
    readonly image: ReadonlyVec4; // a plane coincident with camera position and parallel to screen/image plane in world space
    readonly planes: readonly [left: ReadonlyVec4, right: ReadonlyVec4, top: ReadonlyVec4, bottom: ReadonlyVec4, near: ReadonlyVec4, far: ReadonlyVec4];
}

export enum CoordSpace {
    World,
    View,
    Clip,
};

export interface Matrices {
    getMatrix(from: CoordSpace, to: CoordSpace): ReadonlyMat4;
    getMatrixNormal(from: CoordSpace, to: CoordSpace): ReadonlyMat3;
}

export interface RenderStateOutput {
    readonly width: number;
    readonly height: number;
}

export interface RenderStateBackground {
    readonly color: RGBA;
    readonly url?: string;
    readonly blur?: number;
}

export interface RenderStateCamera {
    readonly kind: "pinhole" | "orthographic";
    readonly position: ReadonlyVec3;
    readonly rotation: ReadonlyQuat;
    readonly fov: number;
    readonly near: number;
    readonly far: number;
}

export interface RenderStateGrid {
    readonly enabled: boolean;
    readonly color: RGBA;
    readonly origin: ReadonlyVec3;
    readonly axisX: ReadonlyVec3;
    readonly axisY: ReadonlyVec3;
    readonly size: number; // integer dimension
    readonly spacing: number; // spacing between each cell
}

export interface RenderStateScene {
    readonly url: string;
    readonly config: OctreeSceneConfig;
}

export const enum TonemappingMode {
    color,
    normal,
    depth,
    objectId,
    deviation,
    intensity,
};

export interface RenderStateTonemapping {
    /** Camera light exposure as stops of power of 2.
     * @remarks
     * Negative values darkens the image, while positive ones brightens it.
     * The default value is 0.0.
     */
    readonly exposure: number;

    /** Debug display frame buffer */
    readonly mode: TonemappingMode;
}

export interface RenderState {
    readonly output: RenderStateOutput;
    readonly background: RenderStateBackground;
    readonly camera: RenderStateCamera;
    readonly grid: RenderStateGrid;
    readonly scene: RenderStateScene | undefined;
    readonly tonemapping: RenderStateTonemapping;
}

export interface DerivedRenderState extends RenderState {
    readonly matrices: Matrices;
    readonly viewFrustum: ViewFrustum;
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
    const clone = { ...original };
    for (const key in changes) {
        const originalValue = original ? original[key] : undefined;
        const changedValue = changes[key];
        if (changedValue && typeof changedValue == "object" && !Array.isArray(changedValue)) {
            clone[key] = mergeRecursive(originalValue, changedValue);
        } else {
            clone[key] = changedValue;
        }
    }
    return clone;
}

export function defaultRenderState(): RenderState {
    const state: RenderState = {
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
            near: 0.1,
            far: 1000,
        },
        grid: {
            enabled: false,
            color: [0, 1, 0, 1],
            origin: [0, 0, 0],
            axisX: [1, 0, 0],
            axisY: [0, 1, 0],
            size: 10,
            spacing: 1,
        },
        scene: undefined,
        tonemapping: {
            exposure: 0,
            mode: TonemappingMode.color,
        },
    };
    return state;
}
