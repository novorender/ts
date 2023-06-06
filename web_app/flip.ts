import type { RenderStateClippingPlane } from "core3d";
import { quat, vec3, vec4, type ReadonlyVec4 } from "gl-matrix";

const transforms = {
    GLToCAD: flipFuncs(flipGLtoCadVec, flipGLtoCadQuat),
    CADToGL: flipFuncs(flipCADToGLVec, flipCADToGLQuat),
};

export function flipState(changes: any, transform: "GLToCAD" | "CADToGL") {
    flipRecursive(changes, transforms[transform]);
}


function flipFuncs(swapVecFunc: (v: number[]) => number[], swapQuadFunc: (q: quat) => quat) {
    const state = {
        camera: {
            position: swapVecFunc,
            rotation: swapQuadFunc,
            pivot: swapVecFunc,
        },
        grid: {
            origin: swapVecFunc,
            axisX: swapVecFunc,
            axisY: swapVecFunc,
        },
        cube: {
            position: swapVecFunc,
        },

        clipping: {
            planes: flipArray(swapVecFunc),
        },
        outlines: {
            plane: swapVecFunc
        },
        scene: {
            config: {
                center: swapVecFunc,
                offset: swapVecFunc,
                boundingSphere: {
                    center: swapVecFunc
                },
                aabb: {
                    min: swapVecFunc,
                    max: swapVecFunc
                }
            }
        }
    } as const;
    return state;
}

function flipCADToGLVec(v: number[]) {
    const clone = [...v];
    const tmp = clone[1];
    clone[1] = clone[2];
    clone[2] = -tmp;
    return clone;
}


export function flipGLtoCadVec(v: number[]) {
    const clone = [...v];
    const tmp = clone[1];
    clone[1] = -clone[2];
    clone[2] = tmp;
    return clone;
}

// function flipCADToGLQuat2(q: quat) {
//     const flipZY = quat.fromValues(-0.7071067811865475, 0, 0, 0.7071067811865476);
//     return quat.mul(quat.create(), flipZY, q);
// }

export function flipCADToGLQuat(b: quat) {
    let ax = -0.7071067811865475,
        aw = 0.7071067811865475;
    let bx = b[0],
        by = b[1],
        bz = b[2],
        bw = b[3];
    return quat.fromValues(
        ax * bw + aw * bx,
        aw * by + - ax * bz,
        aw * bz + ax * by,
        aw * bw - ax * bx);
}

// export function flipGLtoCadQuat(q: quat) {
//     const flipZY = quat.fromValues(0.7071067811865475, 0, 0, 0.7071067811865476);
//     return quat.mul(quat.create(), flipZY, q);
// }

export function flipGLtoCadQuat(b: quat) {
    let ax = 0.7071067811865475,
        aw = 0.7071067811865475;
    let bx = b[0],
        by = b[1],
        bz = b[2],
        bw = b[3];
    return quat.fromValues(
        ax * bw + aw * bx,
        aw * by + - ax * bz,
        aw * bz + ax * by,
        aw * bw - ax * bx);
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
