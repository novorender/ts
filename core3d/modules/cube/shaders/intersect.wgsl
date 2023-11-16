// outlines
struct OutlineUniforms {
    localPlaneMatrix: mat4x4<f32>,
    planeLocalMatrix: mat4x4<f32>,
    color: vec3f,
    planeIndex: i32,
}

// cube
struct CubeUniforms {
    modelLocalMatrix: mat4x4<f32>
}

struct Triangle {
    pos0: vec3f,
    pos1: vec3f,
    pos2: vec3f,
}

struct Output {
    line_vertices: vec2<u32>,
    opacity: f32,
}

@group(0)
@binding(0)
var<uniform> cube: CubeUniforms;

@group(0)
@binding(1)
var<uniform> outline: OutlineUniforms;

@group(0)
@binding(2)
var<storage, read> input: array<Triangle>;

@group(0)
@binding(3)
var<storage, read_write> outputLines: array<vec2u>;

@group(0)
@binding(4)
var<storage, read_write> outputOpacity: array<f32>;

fn intersectEdge(p0: vec3f, p1: vec3f) -> vec2f{
    let t = -p0.z / (p1.z - p0.z);
    return mix(p0.xy, p1.xy, t);
}

@compute
@workgroup_size(1)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    let triangle = input[globalId.x];
    let pos0 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vec4(triangle.pos0, 1.)).xyz;
    let pos1 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vec4(triangle.pos1, 1.)).xyz;
    let pos2 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vec4(triangle.pos2, 1.)).xyz;
    let ab = pos1 - pos0;
    let ac = pos2 - pos0;
    let normal = normalize(cross(ab, ac));
    let z = vec3(pos0.z, pos1.z, pos2.z);
    let gt = z > vec3(0.);
    let lt = z < vec3(0.);
    var i = 0;
    var line = array<vec2f, 3>(vec2(0.), vec2(0.), vec2(0.));
    // does triangle straddle clipping plane?
    if(any(gt) && any(lt)) {
        // find intersecting edges
        if(any(gt.xy) && any(lt.xy)) {
            line[i] = intersectEdge(pos0, pos1);
            i += 1;
        }
        if(any(gt.yz) && any(lt.yz)) {
            line[i] = intersectEdge(pos1, pos2);
            i += 1;
        }
        if(any(gt.zx) && any(lt.zx)) {
            line[i] = intersectEdge(pos2, pos0);
            i += 1;
        }
    }
    let line_vertices = select(vec2(0u), vec2(pack2x16float(line[0]), pack2x16float(line[1])), i == 2);
    let opacity = 1. - abs(normal.z);
    outputLines[globalId.x] = line_vertices;
    outputOpacity[globalId.x] = opacity;
}
