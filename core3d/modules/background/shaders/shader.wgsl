
struct BackgroundUniforms {
    envBlurNormalized: f32,
    mipCount: i32,
}

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

@group(0)
@binding(0)
var<uniform> camera: CameraUniforms;

@group(0)
@binding(1)
var<uniform> background: BackgroundUniforms;

@group(0)
@binding(2)
var skybox: texture_cube<f32>;
@group(0)
@binding(3)
var skyboxSampler: sampler;
@group(0)
@binding(4)
var specular: texture_cube<f32>;
@group(0)
@binding(5)
var specularSampler: sampler;

struct VertexOutput {
    @builtin(position) pos: vec4f,
    @location(0) dir: vec3f,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32)  -> VertexOutput {
    // output degenerate triangle if ortho camera to use clear color instead
    let isPerspective = camera.viewClipMatrix[3][3] == 0.0;
    let pos = vec2f(vec2((vertexIndex << 1u) & 2u, vertexIndex & 2u)) * 2.0 - 1.0;
    var position: vec4f;
    if(isPerspective){
        position = vec4(pos, 1., 1.);
    }else{
        position = vec4(0.);
    }
    var dirVS = vec3(pos.x / camera.viewClipMatrix[0][0], pos.y / camera.viewClipMatrix[1][1], -1.);
    dirVS.y *= -1.;
    return VertexOutput(
        position,
        camera.viewLocalMatrixNormal * dirVS
    );
}


struct FragInput {
    @location(0) dir: vec3f,
}

@fragment
fn fragmentMain(input: FragInput) -> @location(0) vec4f {
    var rgb: vec3f;
    if(background.envBlurNormalized == 0.f) {
        rgb = textureSampleLevel(skybox, skyboxSampler, normalize(input.dir), 0.).rgb;
    } else {
        var lod = background.envBlurNormalized * f32(background.mipCount - 1);
        // lod = min(lod, f32(background.mipCount - 4)); // the last 3 mips are black for some reason (because of RGBA16F format?), so we clamp to avoid this.
        rgb = textureSampleLevel(specular, specularSampler, normalize(input.dir), lod).rgb;
    }
    return vec4(rgb, 1.);
}
