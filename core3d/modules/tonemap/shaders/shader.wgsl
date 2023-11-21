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


fn unpackNormalAndDeviation(normalAndDeviation: vec2u) -> vec4f{
    return vec4(unpack2x16float(normalAndDeviation[0]), unpack2x16float(normalAndDeviation[1]));
}

@group(0)
@binding(0)
var<uniform> tonemapping: TonemappingUniforms;

@group(0)
@binding(1)
var outputTexture: texture_storage_2d<rgba8unorm, write>;

@group(1)
@binding(0)
var colorTexture: texture_2d<f32>;

@group(1)
@binding(1)
var pickTexture: texture_2d<u32>;

@group(1)
@binding(2)
var zbufferTexture: texture_2d<f32>;

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

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // uvs from fullscreen triangle:
    // https://www.saschawillems.de/blog/2016/08/13/vulkan-tutorial-on-rendering-a-fullscreen-quad-without-buffers/
    // But webgpu has same coordinate system for ndc and texture coords as directx rather than vulkan
    // so we need to flip y
    let uv = vec2f(vec2((vertexIndex << 1u) & 2u, vertexIndex & 2u));
    return VertexOutput(
        vec4(uv * vec2(2., -2.) + vec2(-1., 1.), 0., 1.),
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

fn tonemap(uv: vec2<i32>) -> vec4f {
    var rgb: vec3f;
    switch(tonemapping.mode) {
        case tonemapModeColor: {
            let color = textureLoad(colorTexture, uv, 0);
            rgb = RRTAndODTFit(color.rgb * tonemapping.exposure);
            rgb = linearTosRGB(rgb);
            return vec4(rgb, color.a);
        }
        case tonemapModeNormal: {
            let xyz = unpackNormalAndDeviation(vec2u(textureLoad(pickTexture, uv, 0).yz)).xyz;
            let isnan: vec3<bool> = xyz != xyz;
            if(any(isnan)) {
                rgb = vec3(0.);
            } else {
                rgb = xyz * .5f + .5f;
            }
            return vec4(rgb, 1.);
        }
        case tonemapModeDepth: {
            let linearDepth = bitcast<f32>(textureLoad(pickTexture, uv, 0).w);
            // TODO: No isInf yet in wgsl
            // if(isInf(linearDepth)) {
            //     rgb = vec3(0., 0., 0.25);
            // } else {
                let i = (linearDepth / tonemapping.maxLinearDepth);
                rgb = vec3(pow(i, 0.5));
            // }
            return vec4(rgb, 1.);
        }
        case tonemapModeObjectId: {
            let objectId = textureLoad(pickTexture, uv, 0).x;
            if(objectId == 0xffffffffu) {
                rgb = vec3(0.);
            } else {
                // color.rgb = vec3(0,1,1);
                let rgba = hash(~objectId);
                let r = f32((rgba >> 16u) & 0xffu) / 255.;
                let g = f32((rgba >> 8u) & 0xffu) / 255.;
                let b = f32((rgba >> 0u) & 0xffu) / 255.;
                rgb = vec3(r, g, b);
            }
            return vec4(rgb, 1.);
        }
        case tonemapModeDeviation: {
            let deviation = unpackNormalAndDeviation(textureLoad(pickTexture, uv, 0).yz).w;
            rgb = select(vec3(-deviation / tonemapMaxDeviation, 0., 0.), vec3(0., deviation / tonemapMaxDeviation, 0.), deviation > 0.);
            return vec4(rgb, 1.);
        }
        case tonemapModeZbuffer: {
            let z = textureLoad(zbufferTexture, uv, 0).x;
            rgb = vec3(z);
            return vec4(rgb, 1.);
        }
        default: {
            return vec4(1.);
        }
    }
}

@fragment
fn fragmentMain(input: FragInput) -> @location(0) vec4f {
    var uv: vec2i;
    switch(tonemapping.mode) {
        case tonemapModeColor: {
            uv = vec2<i32>(input.uv * vec2f(textureDimensions(colorTexture)));
            break;
        }
        case tonemapModeNormal, tonemapModeDepth, tonemapModeObjectId, tonemapModeDeviation: {
            uv = vec2<i32>(input.uv * vec2f(textureDimensions(pickTexture)));
            break;
        }
        case tonemapModeZbuffer: {
            uv = vec2<i32>(input.uv * vec2f(textureDimensions(zbufferTexture)));
            break;
        }
        default: { break; }
    }
    return tonemap(uv);
}

@compute
@workgroup_size(1)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let uv = vec2i(global_id.xy);
    textureStore(outputTexture, uv, tonemap(uv));
}