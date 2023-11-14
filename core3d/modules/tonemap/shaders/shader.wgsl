
struct TonemappingUniforms {
    exposure: f32,
    mode: u32,
    maxLinearDepth: f32,
};

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
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
var colorTexture: texture_2d<f32>;
@group(0)
@binding(1)
var colorSampler: sampler;

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

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // uvs from fullscreen triangle:
    // https://www.saschawillems.de/blog/2016/08/13/vulkan-tutorial-on-rendering-a-fullscreen-quad-without-buffers/
    let uv = vec2f(vec2((vertexIndex << 1u) & 2u, vertexIndex & 2u));
    return VertexOutput(
        vec4(uv * 2. - 1., 0., 1.),
        uv
    );
}

const GAMMA = 2.2f;
const INV_GAMMA = 1.0f / GAMMA;

// linear to sRGB approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
fn linearTosRGB(color: vec3f) -> vec3f {
    return pow(color, vec3(INV_GAMMA));
}

struct FragInput {
    @location(0) uv: vec2f,
}

@fragment
fn fragmentMain(input: FragInput) -> @location(0) vec4f {
    var color = vec4(1., 0., 0., 1.);
    color = textureSampleLevel(colorTexture, colorSampler, input.uv, 0.);
    var rgb = RRTAndODTFit(color.rgb * tonemapping.exposure);
    rgb = linearTosRGB(rgb);
    return vec4(rgb, color.a);
}