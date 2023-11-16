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

// cube
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
var<uniform> outline: OutlineUniforms;

struct VertexInput {
    @builtin(vertex_index) index: u32,
    @location(0) positions: vec4f,
    @location(1) opacity: f32,
}

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) posVS: vec3f,
    @location(1) opacity: f32,
}

@vertex
fn vertexMain(vertex: VertexInput) -> VertexOutput {
    let pos = select(vertex.positions.zw, vertex.positions.xy, vertex.index % 2u == 0u);
    let posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0., 1.)).xyz;
    return VertexOutput (
        camera.viewClipMatrix * vec4(posVS, 1.),
        posVS,
        vertex.opacity,
    );
}

struct FragmentInput {
    @location(0) posVS: vec3f,
    @location(1) opacity: f32,
}

@fragment
fn fragmentMain(vertex: FragmentInput) -> @location(0) vec4f {
    if(clipOutlines(vertex.posVS, clipping)) {
        discard;
    }
    return vec4(outline.color, vertex.opacity);
}