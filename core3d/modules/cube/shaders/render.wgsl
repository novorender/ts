// #import novorender::common

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
    return select(!inside, inside, clipping.mode == clippingModeIntersection);
}

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

// cube
const cubeId = 0xfffffff8u;
@id(0) override PICK: bool;

struct CubeUniforms {
    modelLocalMatrix: mat4x4<f32>
}

@group(0)
@binding(0)
var<uniform> camera: CameraUniforms;

@group(0)
@binding(1)
var<uniform> clipping: ClippingUniforms;

@group(0)
@binding(2)
var<uniform> cube: CubeUniforms;

struct VertexInput {
    @location(0) position: vec4f,
    @location(1) normal: vec3f,
    @location(2) color: vec3f,
}

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) posVS: vec3f,
    @location(1) normal: vec3f,
    @location(2) color: vec3f,
}

@vertex
fn vertexMain(vertex: VertexInput) -> VertexOutput {
    let posVS = camera.localViewMatrix * cube.modelLocalMatrix * vertex.position;
    let pos = camera.viewClipMatrix * posVS;
    return VertexOutput (
        pos,
        posVS.xyz,
        vertex.normal,
        vertex.color,
    );
}

struct FragmentInput {
    @builtin(front_facing) frontFacing: bool,
    @location(0) posVS: vec3f,
    @location(1) normal: vec3f,
    @location(2) color: vec3f,
}

struct FragmentOutput {
    @location(0) color: vec4f,
    @location(1) pick: vec4<u32>,
}

@fragment
fn fragmentMain(vertex: FragmentInput) -> FragmentOutput {
    let linearDepth = -vertex.posVS.z;
    if(linearDepth < camera.near || clip(vertex.posVS, clipping)) {
        discard;
    }

    // TODO: Original ifdefs but uses different locations, test if this is realy working for pick
    if !PICK {
        return FragmentOutput (
            select(vec4(vec3(0.25), 1.), vec4(vertex.color, 1.), vertex.frontFacing),
            vec4(0u)
        );
    }else{
        return FragmentOutput(
            vec4(0.),
            vec4<u32>(cubeId, packNormal(normalize(vertex.normal)), bitcast<u32>(linearDepth))
        );
    }
}