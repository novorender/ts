import fillrate_vert from "./fillrate.vert";
import fillrate_frag from "./fillrate.frag";
import pointrate_vert from "./pointrate.vert";
import pointrate_frag from "./pointrate.frag";
import type { Shaders } from "core3d/modules/shaders";

/** @internal */
export const shaders = {
    fillrate: {
        vertexShader: fillrate_vert,
        fragmentShader: fillrate_frag,
    },
    pointrate: {
        vertexShader: pointrate_vert,
        fragmentShader: pointrate_frag,
    },
} as const satisfies Shaders;
