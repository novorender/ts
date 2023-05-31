import type { RenderStateClippingPlane } from "core3d";
import { quat, vec3, vec4, type ReadonlyVec4 } from "gl-matrix";

const transforms = {
    GLToCAD: flipFuncs(flipGLtoCad),
    CADToGL: flipFuncs(flipCADToGL),
};

export function flipState(changes: any, transform: "GLToCAD" | "CADToGL") {
    flipRecursive(changes, transforms[transform]);
}

function flipFuncs(swapFunc: (v: number[]) => number[]) {
    const state = {
        camera: {
            position: swapFunc,
            //rotation: swapFunc,
            pivot: swapFunc,
        },
        grid: {
            origin: swapFunc,
            axisX: swapFunc,
            axisY: swapFunc,
        },
        cube: {
            position: swapFunc,
        },

        clipping: {
            planes: flipArray(swapFunc),
        },
        outlines: {
            plane: swapFunc
        }

    } as const;
    return state;
}

function flipCADToGL(v: number[]) {
    const clone = [...v];
    const tmp = clone[1];
    clone[1] = clone[2];
    clone[2] = -tmp;
    return clone;
}


export function flipGLtoCad(v: number[]) {
    const clone = [...v];
    const tmp = clone[1];
    clone[1] = -clone[2];
    clone[2] = tmp;
    return clone;
}


function flipArray(swapFunc: (v: number[]) => number[]) {
    return function (ar: RenderStateClippingPlane[]) {
        const flippedPlanes: RenderStateClippingPlane[] = [];
        for (const plane of ar) {
            flippedPlanes.push({ color: plane.color, normalOffset: swapFunc(plane.normalOffset as any as number[]) as any as ReadonlyVec4 });
        }
        return flippedPlanes;
    }
}

export function flipRecursive(state: any, funcs: any) {
    for (const key in state) {
        const func = funcs ? funcs[key] : undefined;
        const value = state[key];
        if (func && value) {
            if (typeof func == "function") {
                state[key] = func(value);
            } else {
                flipRecursive(value, func);
            }
        }
    }
}
