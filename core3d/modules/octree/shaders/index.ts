import render_vert from "./render.vert";
import render_frag from "./render.frag";
import line_vert from "./line.vert";
import line_frag from "./line.frag";
import intersect_vert from "./intersect.vert";
import debug_vert from "./debug.vert";
import debug_frag from "./debug.frag";

type Shaders = { readonly [P in string]: { readonly vertexShader: string; readonly fragmentShader?: string; } };

/** @internal */
export const shaders = {
    render: {
        vertexShader: render_vert,
        fragmentShader: render_frag,
    },
    line: {
        vertexShader: line_vert,
        fragmentShader: line_frag,
    },
    intersect: {
        vertexShader: intersect_vert,
    },
    debug: {
        vertexShader: debug_vert,
        fragmentShader: debug_frag,
    },
} as const satisfies Shaders;
