import type { Shaders, ShadersWGSL } from "../../shaders";
import render_vert from "./render.vert";
import render_frag from "./render.frag";
import line_vert from "./line.vert";
import line_frag from "./line.frag";
import intersect_vert from "./intersect.vert";

import render_wgsl from "./render.wgsl";
import line_wgsl from "./line.wgsl";
import intersect_wgsl from "./intersect.wgsl";

const shaders = {
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
} as const satisfies Shaders;

export const shadersWGSL = {
    render: {
        shader: render_wgsl,
    },
    line: {
        shader: line_wgsl,
    },
    intersect: {
        shader: intersect_wgsl,
    },
} as const satisfies ShadersWGSL;

/** @internal */
export default shaders;