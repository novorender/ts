import type { Shaders, ShadersWGSL } from "../../shaders";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";
import wgslShader from "./shader.wgsl";

const shaders = {
    render: {
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
    },
} as const satisfies Shaders;

export const shadersWGSL = {
    render: {
        shader: wgslShader,
    },
} as const satisfies ShadersWGSL;

/** @internal */
export default shaders;