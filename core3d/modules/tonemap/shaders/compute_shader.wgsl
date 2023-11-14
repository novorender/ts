struct TonemappingUniforms {
    exposure: f32,
    mode: u32,
    maxLinearDepth: f32,
};

const tonemapMaxDeviation: f32 = 1.f;
const tonemapModeColor: u32 = 0u;
const tonemapModeNormal: u32 = 1u;
const tonemapModeDepth: u32 = 2u;
const tonemapModeObjectId: u32 = 3u;
const tonemapModeDeviation: u32 = 4u;
const tonemapModeZbuffer: u32 = 5u;

@group(0)
@binding(0)
var inputTexture: texture_2d<f32>;

@group(0)
@binding(1)
var outputTexture: texture_storage_2d<rgba32float, write>;

@group(0)
@binding(2)
var<uniform> tonemapping: TonemappingUniforms;

fn hash(x: u32) -> u32 {
    var xx = x;
    xx += (xx << 10u);
    xx ^= (xx >> 6u);
    xx += (xx << 3u);
    xx ^= (xx >> 11u);
    xx += (xx << 15u);
    return xx;
}

// ACES tone map (faster approximation)
// see: https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
fn toneMapACES_Narkowicz(color: vec3f) -> vec3f {
    const A = 2.51;
    const B = 0.03;
    const C = 2.43;
    const D = 0.59;
    const E = 0.14;
    return clamp((color * (A * color + B)) / (color * (C * color + D) + E), vec3(0.0), vec3(1.0));
}

// ACES filmic tone map approximation
// see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
fn RRTAndODTFit(color: vec3f) -> vec3f {
    let a = color * (color + 0.0245786f) - 0.000090537f;
    let b = color * (0.983729f * color + 0.4329510f) + 0.238081f;
    return a / b;
}

const GAMMA = 2.2f;
const INV_GAMMA = 1.0f / GAMMA;

// linear to sRGB approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
fn linearTosRGB(color: vec3f) -> vec3f {
    return pow(color, vec3(INV_GAMMA));
}

@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let uv = vec2<i32>(global_id.xy);
    var color = vec4(1., 0., 0., 1.);
    color = textureLoad(inputTexture, uv, 0);
    var rgb = RRTAndODTFit(color.rgb * tonemapping.exposure);
    rgb = linearTosRGB(rgb);
    textureStore(outputTexture, uv, vec4(rgb, color.a));
}