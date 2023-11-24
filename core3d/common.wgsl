#define_import_path novorender::camera_uniforms

// camera
struct CameraUniforms {
    clipViewMatrix: mat4x4<f32>,
    viewClipMatrix: mat4x4<f32>,
    localViewMatrix: mat4x4<f32>,
    viewLocalMatrix: mat4x4<f32>,
    localViewMatrixNormal: mat3x3<f32>,
    viewLocalMatrixNormal: mat3x3<f32>,
    viewSize: vec2f,
    near: f32, // near clipping plane distance
}

// clipping
const undefinedIndex = 7u;
const clippingId = 0xfffffff0u;
const clippingModeIntersection = 0u;
const clippingModeUnion = 1u;

struct ClippingUniforms {
    planes: array<vec4f, 6>,
    numPlanes: u32,
    mode: u32, // 0 = intersection, 1 = union
}

fn clip(point: vec3f, clipping: ClippingUniforms) -> bool{
    let s = select(1., -1., clipping.mode == clippingModeIntersection);
    var inside = select(true, clipping.numPlanes > 0u, clipping.mode == clippingModeIntersection);
    for(var i = 0u; i < clipping.numPlanes; i += 1u) {
        inside = inside && dot(vec4(point, 1.), clipping.planes[i]) * s < 0.f;
    }
    if(clipping.mode == clippingModeIntersection){
        return inside;
    }else{
        return !inside;
    }
}

// outlines
struct OutlineUniforms {
    localPlaneMatrix: mat4x4<f32>,
    planeLocalMatrix: mat4x4<f32>,
    color: vec3f,
    planeIndex: i32,
}

fn clipOutlines(point: vec3f, clipping: ClippingUniforms) -> bool {
    let s = select(1., -1., clipping.mode == clippingModeIntersection);
    var inside = select(true, clipping.numPlanes > 0u, clipping.mode == clippingModeIntersection);
    for(var i = 0u; i < clipping.numPlanes; i += 1u) {
        inside = inside && dot(vec4(point, 1.), clipping.planes[i]) * s < 0.f;
    }
    return !inside;
}

// packing
fn packNormalAndDeviation(normal: vec3f, deviation: f32) -> vec2<u32>{
    return vec2(pack2x16float(normal.xy), pack2x16float(vec2(normal.z, deviation)));
}

fn packNormal(normal: vec3f) -> vec2<u32>{
    return packNormalAndDeviation(normal, 0.f);
}

fn unpackNormalAndDeviation(normalAndDeviation: vec2<u32>) -> vec4f{
    return vec4(unpack2x16float(normalAndDeviation[0]), unpack2x16float(normalAndDeviation[1]));
}

fn combineMediumP(high: u32, low: u32) -> u32{
    return (high << 16u) | (low & 0xffffu);
}

//sRGB
const GAMMA: f32 = 2.2;
const INV_GAMMA: f32 = 1.0 / GAMMA;
// linear to sRGB approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
fn linearTosRGB(color: vec3f) -> vec3f {
    return pow(color, vec3(INV_GAMMA));
}

// sRGB to linear approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
fn sRGBToLinear(srgbIn: vec3f) -> vec3f{
    return vec3(pow(srgbIn.xyz, vec3(GAMMA)));
}

fn toLinear(f: f32) -> f32{
    if(f <= 0.0404482362771082f) {
        return f / 12.92f;
    }

    return pow(((f + 0.055f) / 1.055f), 2.4f);
}

// sRGB to linear approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
fn sRGBToLinearComplex(srgbIn: vec3f) -> vec3f{
    return vec3(toLinear(srgbIn.r), toLinear(srgbIn.g), toLinear(srgbIn.b));
}