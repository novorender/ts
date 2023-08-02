import type { Shaders } from "../../shaders";
import vertexShader from "./shader.vert";
import fragmentShader from "./shader.frag";

const shaders = {
    render: {
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
    },
} as const satisfies Shaders;

/** @internal */
export default shaders;