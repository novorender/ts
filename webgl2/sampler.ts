import type { RendererContext } from ".";
import type { SamplerParams } from "./types";

export function createSampler(context: RendererContext, params: SamplerParams): WebGLSampler {
    const { gl } = context;
    const sampler = gl.createSampler();
    if (!sampler)
        throw new Error("Could not create sampler!");
    gl.bindSampler(0, sampler);
    const { minificationFilter, magnificationFilter, minLOD, maxLOD, wrap, compareFunction, compareMode } = params;
    if (minificationFilter)
        gl.samplerParameteri(sampler, gl.TEXTURE_MIN_FILTER, gl[minificationFilter]); // default: NEAREST_MIPMAP_LINEAR
    if (magnificationFilter)
        gl.samplerParameteri(sampler, gl.TEXTURE_MAG_FILTER, gl[magnificationFilter]); // default: LINEAR
    if (wrap) {
        const [s, t, r] = wrap;
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_S, gl[s]); // default: REPEAT
        gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_T, gl[t]); // default: REPEAT
        if (r)
            gl.samplerParameteri(sampler, gl.TEXTURE_WRAP_R, gl[r]); // default: REPEAT
    }
    if (minLOD)
        gl.samplerParameterf(sampler, gl.TEXTURE_MIN_LOD, minLOD); // default: -1000
    if (maxLOD)
        gl.samplerParameterf(sampler, gl.TEXTURE_MAX_LOD, maxLOD); // default: 1000
    if (compareFunction)
        gl.samplerParameteri(sampler, gl.TEXTURE_COMPARE_FUNC, gl[compareFunction]);
    if (compareMode)
        gl.samplerParameteri(sampler, gl.TEXTURE_COMPARE_MODE, gl[compareMode]);
    return sampler;
}
