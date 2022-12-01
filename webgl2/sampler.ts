export type WrapString = "CLAMP_TO_EDGE" | "MIRRORED_REPEAT" | "REPEAT";
export type MinFilterString = "NEAREST" | "LINEAR" | "NEAREST_MIPMAP_NEAREST" | "LINEAR_MIPMAP_NEAREST" | "NEAREST_MIPMAP_LINEAR" | "LINEAR_MIPMAP_LINEAR";
export type MagFilterString = "NEAREST" | "LINEAR";
export type CompareFuncString = "NEVER" | "LESS" | "EQUAL" | "LEQUAL" | "GREATER" | "NOTEQUAL" | "GEQUAL" | "ALWAYS";
export type CompareModeString = "COMPARE_REF_TO_TEXTURE" | "NONE";

export function glSampler(gl: WebGL2RenderingContext, params: SamplerParams): WebGLSampler {
    const sampler = gl.createSampler()!;
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

export interface SamplerParams {
    readonly minificationFilter?: MinFilterString; // default: NEAREST_MIPMAP_LINEAR
    readonly magnificationFilter?: MagFilterString; // default: LINEAR
    readonly minLOD?: number; // default: -1000
    readonly maxLOD?: number; // default: 1000
    readonly compareFunction?: CompareFuncString;
    readonly compareMode?: CompareModeString;
    readonly wrap?: readonly [WrapString, WrapString] | readonly [WrapString, WrapString, WrapString]; // ST, or STR coordinate wrapping. default: REPEAT
};

