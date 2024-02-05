@group(0)
@binding(0)
var input: texture_2d<f32>;

@group(0)
@binding(1)
var output: texture_storage_2d<rgba8unorm, write>;

fn floor_frac(x: f32, floor_: ptr<function, i32>, frac_: ptr<function, f32>) {
    let ffloor = floor(x);
    *floor_ = i32(ffloor);
    *frac_ = x - ffloor;
}

const n: u32 = 2u;
const n2 = n * n;
@id(0) override NORMALIZE: bool;
@id(1) override BLOCK_DIM: u32;

@compute
@workgroup_size(BLOCK_DIM, BLOCK_DIM, 1)
fn generate_mipmaps_linear(@builtin(global_invocation_id) global_id: vec3<u32>) {
	let out_uv = global_id.xy;
    if !any(out_uv < textureDimensions(output)) {
        return;
    }

    let in_uv = out_uv * 2;
	let fin_uv = (vec2<f32>(out_uv) + vec2(0.5)) / vec2<f32>(textureDimensions(output)) * vec2<f32>(textureDimensions(input));
    let x = fin_uv.x - 0.5;
    let y = fin_uv.y - 0.5;
    var fx1: f32;
    var px: i32;
    floor_frac(x, &px, &fx1);
    var fy1: f32;
    var py: i32;
    floor_frac(x, &py, &fy1);

    // Linear
    let fx2 = 1. - fx1;
    let fy2 = 1. - fy1;
    let p11 = textureLoad(input, in_uv + vec2(0, 0), 0);
    let p21 = textureLoad(input, in_uv + vec2(1, 0), 0);
    let p12 = textureLoad(input, in_uv + vec2(0, 1), 0);
    let p22 = textureLoad(input, in_uv + vec2(1, 1), 0);
    var color = p11 * fx2 * fy2 + p21 * fx1 * fy2 + p12 * fx2 * fy1 + p22 * fx1 * fy1;

    // reduce "contrast" by gradually reducing the xyz components
    // xyz = mix(uniforms.neutral, xyz, uniforms.contrast);

    if(NORMALIZE) {
        color = vec4(normalize(color.rgb), color.a);
    }

    textureStore(output, out_uv, color);
}

@compute
@workgroup_size(BLOCK_DIM, BLOCK_DIM, 1)
fn generate_mipmaps_nearest(@builtin(global_invocation_id) global_id: vec3<u32>) {
    var weights = array<f32, n2>(.25, .25, .25, .25);
	let out_uv = global_id.xy;
    if !any(out_uv < textureDimensions(output)) {
        return;
    }

    var in_uv = out_uv * 2;

    // filter pixel
    var color = vec4f(0.);
    for (var y = 0u; y < n; y++) {
        for (var x = 0u; x < n; x++) {
            color += textureLoad(input, in_uv + vec2u(x, y), 0) * weights[x + y * n];
        }
    }

    // reduce "contrast" by gradually reducing the xyz components
    // xyz = mix(uniforms.neutral, xyz, uniforms.contrast);

    if(NORMALIZE) {
        color = vec4(normalize(color.rgb), color.a);
    }

    textureStore(output, out_uv, color);
}
