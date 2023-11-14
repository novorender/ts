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

struct GridUniforms {
    // below coords are in local space
    origin: vec3f,
    axisX: vec3f,
    axisY: vec3f,
    size1: f32,
    size2: f32,
    color1: vec3f,
    color2: vec3f,
    distance: f32,
}

@group(0)
@binding(0)
var<uniform> camera: CameraUniforms;

@group(0)
@binding(1)
var<uniform> grid: GridUniforms;

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) posOS: vec2f,
    @location(1) posLS: vec3f,
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let cameraPosLS = camera.viewLocalMatrix[3].xyz;
    var posOS = (vec2f(vec2((vertexIndex << 1u) & 2u, vertexIndex & 2u)) * 2.0 - 1.0) * grid.distance;
    posOS += vec2(dot(cameraPosLS - grid.origin, grid.axisX), dot(cameraPosLS - grid.origin, grid.axisY));
    let posLS = grid.origin + grid.axisX * posOS.x + grid.axisY * posOS.y;
    return VertexOutput(
        camera.viewClipMatrix * camera.localViewMatrix * vec4(posLS, 1.),
        posOS,
        posLS
    );
}

fn getGrid(r: vec2f) -> f32 {
    let grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
    let line = min(grid.x, grid.y);
    return 1.0f - min(line, 1.0f);
}

struct FragInput {
    @location(0) posOS: vec2f,
    @location(1) posLS: vec3f,
}

@fragment
fn fragmentMain(input: FragInput) -> @location(0) vec4f {
    let cameraPosLS = camera.viewLocalMatrix[3].xyz;
    let d = 1.0 - min(distance(cameraPosLS, input.posLS) / grid.distance, 1.0);
    let g1 = getGrid(input.posOS / grid.size1);
    let g2 = getGrid(input.posOS / grid.size2);
    var color: vec3f;
    if(g2 > 0.001) {
        color = grid.color2;
    }else{
        color = grid.color1;
    }
    var fragColor = vec4(color, max(g2, g1) * pow(d, 3.0));
    fragColor.a = mix(0.5f * fragColor.a, fragColor.a, g2) * 1.5f;
    if(fragColor.a <= 0.0f) {
        discard;
    }

    return fragColor;
}