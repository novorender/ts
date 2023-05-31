import { quat, vec3, vec4 } from "gl-matrix";

const transforms = {
    GLToCAD: flipFuncs(flipGLtoCad),
    CADToGL: flipFuncs(flipCADToGL),
};

export function flipState(changes: any, transform: "GLToCAD" | "CADToGL") {
    flipRecursive(changes, transforms[transform]);
}

function flipFuncs(swapFunc: (v: number[]) => void) {
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


function flipGLtoCad(v: number[]) {
    const clone = [...v];
    const tmp = clone[1];
    clone[1] = -clone[2];
    clone[2] = tmp;
    return clone;
}


function flipArray(swapFunc: (v: number[]) => void) {
    return function (ar: number[][]) {
        for (const plane of ar) {
            swapFunc(plane);
        }
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
