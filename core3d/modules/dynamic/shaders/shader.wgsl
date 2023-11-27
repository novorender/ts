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

struct MaterialUniforms {
    baseColorFactor: vec4f,
    emissiveFactor: vec3f,
    roughnessFactor: f32,
    metallicFactor: f32,
    normalScale: f32,
    occlusionStrength: f32,
    alphaCutoff: f32,
    baseColorUVSet: i32,
    metallicRoughnessUVSet: i32,
    normalUVSet: i32,
    occlusionUVSet: i32,
    emissiveUVSet: i32,
    radianceMipCount: u32,
}

struct ObjectUniforms {
    worldLocalMatrix: mat4x4<f32>,
    baseObjectId: u32,
}

@group(0)
@binding(0)
var<uniform> camera: CameraUniforms;

@group(1)
@binding(0)
var<uniform> object: ObjectUniforms;

@group(2)
@binding(0)
var<uniform> material: MaterialUniforms;
@group(2)
@binding(1)
var lut_ggxTexture: texture_2d<f32>;
@group(2)
@binding(2)
var lut_ggxSampler: sampler;
@group(2)
@binding(3)
var diffuseTexture: texture_cube<f32>;
@group(2)
@binding(4)
var diffuseSampler: sampler;
@group(2)
@binding(5)
var specularTexture: texture_cube<f32>;
@group(2)
@binding(6)
var specularSampler: sampler;
@group(2)
@binding(7)
var base_colorTexture: texture_2d<f32>;
@group(2)
@binding(8)
var base_colorSampler: sampler;
@group(2)
@binding(9)
var metallic_roughnessTexture: texture_2d<f32>;
@group(2)
@binding(10)
var metallic_roughnessSampler: sampler;
@group(2)
@binding(11)
var normalTexture: texture_2d<f32>;
@group(2)
@binding(12)
var normalSampler: sampler;
@group(2)
@binding(13)
var emissiveTexture: texture_2d<f32>;
@group(2)
@binding(14)
var emissiveSampler: sampler;
@group(2)
@binding(15)
var occlusionTexture: texture_2d<f32>;
@group(2)
@binding(16)
var occlusionSampler: sampler;

struct VertexInput {
    @builtin(instance_index) instanceIdx: u32,
    @builtin(vertex_index) index: u32,
    @location(0) position: vec4f,
    @location(1) normal: vec3f,
    @location(2) tangent: vec4f,
    @location(3) color0: vec4f,
    @location(4) texCoord0: vec2f,
    @location(5) texCoord1: vec2f,
    @location(6) instanceMatrix0: vec3<f32>,
    @location(7) instanceMatrix1: vec3<f32>,
    @location(8) instanceMatrix2: vec3<f32>,
    @location(9) instanceMatrix3: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4f,
    // @builtin(point_size) pointSize: f32, // Not supported
    @location(0) positionVS: vec3f,
    @location(1) toCamera: vec3f,
    @location(2) color0: vec4f,
    @location(3) texCoord0: vec2f,
    @location(4) texCoord1: vec2f,
    @location(5) linearDepth: f32,
    @location(6) tangentLS: vec3f,
    @location(7) bitangentLS: vec3f,
    @location(8) normalLS: vec3f,
    @location(9) @interpolate(flat) objectId: u32 // TODO: gl uses high/low vars for adreno600
}

@vertex
fn vertexMain(vertex: VertexInput) -> VertexOutput {
    let instanceMatrix = mat4x4(
        vec4(vertex.instanceMatrix0, 0.),
        vec4(vertex.instanceMatrix1, 0.),
        vec4(vertex.instanceMatrix2, 0.),
        vec4(vertex.instanceMatrix3, 1.),
    );
    let instanceMatrixNormal = mat3x3(
        vertex.instanceMatrix0,
        vertex.instanceMatrix1,
        vertex.instanceMatrix2,
    ); // TODO: normalize?

    let posVS = camera.localViewMatrix * instanceMatrix * vertex.position;
    // let posVS = vertex.instanceMatrix3;

// FIX: Setting the position to fullscreen quad shows a full screen solid color with the correct color
// so the problem shoud be something with either the camera matrix or the vertex buffer since the instance
// matrix set to identity doesn't show anything either
    let position = camera.viewClipMatrix * posVS;
    // let pos = vec2f(vec2((vertex.index << 1u) & 2u, vertex.index & 2u)) * 2.0 - 1.0;
    // let position = vec4(pos, 1., 1.);

    // let pointSize = 1.;
    let normalLS = instanceMatrixNormal * vertex.normal;
    let tangentLS = instanceMatrixNormal * vertex.tangent.xyz;
    let cameraPosLS = camera.viewLocalMatrix[3].xyz;
    let vertexPosLS = (instanceMatrix * vertex.position).xyz;
    let bitangentLS = cross(normalLS, tangentLS.xyz) * vertex.tangent.w;
    let objId = select(object.baseObjectId, object.baseObjectId + vertex.instanceIdx, object.baseObjectId != 0xffffu);
    let toCamera = cameraPosLS - vertexPosLS;
    let linearDepth = -posVS.z;
    return VertexOutput(
        position,
        // pointSize,
        posVS.xyz,
        toCamera,
        vertex.color0,
        vertex.texCoord0,
        vertex.texCoord1,
        linearDepth,
        tangentLS,
        bitangentLS,
        normalLS,
    // TODO
    // #if defined (ADRENO600)
    //     vertexFlat.objectId_high = objId >> 16u;
    //     vertexFlat.objectId_low = objId & 0xffffu;
    // #else
        objId,
    );
}

struct FragmentInput {
    @location(0) positionVS: vec3f,
    @location(1) toCamera: vec3f,
    @location(2) color0: vec4f,
    @location(3) texCoord0: vec2f,
    @location(4) texCoord1: vec2f,
    @location(5) linearDepth: f32,
    @location(6) tangentLS: vec3f,
    @location(7) bitangentLS: vec3f,
    @location(8) normalLS: vec3f,
    @location(9) @interpolate(flat) objectId: u32 // TODO: gl uses high/low vars for adreno600
}

struct FragmentOutput {
    @location(0) color: vec4f,
    @location(1) pick: vec4u,
}


fn clampedDot(x: vec3f, y: vec3f) -> f32{
    return clamp(dot(x, y), 0.0, 1.0);
}

struct NormalInfo {
    ng: vec3f,   // Geometric normal
    n: vec3f,    // Pertubed normal
    t: vec3f,    // Pertubed tangent
    b: vec3f,    // Pertubed bitangent
}

const ambientLight: vec3f = vec3(0.);
@id(0) override PBR_METALLIC_ROUGHNESS: bool;

// Get normal, tangent and bitangent vectors.
fn getNormalInfo(vertex: FragmentInput, v: vec3f) -> NormalInfo {
    // let tbn = mat3x3(vertex.tangentLS, vertex.bitangentLS, vertex.normalLS);
    let UV = select(vertex.texCoord1, vertex.texCoord0, material.normalUVSet == 0);
    var uv_dx = dpdx(vec3(UV, 0.));
    var uv_dy = dpdy(vec3(UV, 0.));

    if(length(uv_dx) + length(uv_dy) <= 1e-6f) {
        uv_dx = vec3(1.0f, 0.0f, 0.0f);
        uv_dy = vec3(0.0f, 1.0f, 0.0f);
    }

    let t_ = (uv_dy.y * dpdx(v) - uv_dx.y * dpdy(v)) / (uv_dx.x * uv_dy.y - uv_dy.x * uv_dx.y);

    let axisX = dpdx(vertex.positionVS);
    let axisY = dpdy(vertex.positionVS);
    let geometricNormalVS = normalize(cross(axisX, axisY));

    var nrm = vertex.normalLS;
    if(dot(nrm, nrm) < 0.5) {
        nrm = camera.viewLocalMatrixNormal * geometricNormalVS;
    }
    var ng = normalize(nrm);
    // ng = normalize(vertex.tbn[2]);
    var t = normalize(t_ - ng * dot(ng, t_));
    var b = cross(ng, t);

    // // Normalize eigenvectors as matrix is linearly interpolated.
    // t = normalize(vertex.tbn[0]);
    // b = normalize(vTvertex.tbnBN[1]);
    // ng = normalize(vertex.tbn[2]);

    // For a back-facing surface, the tangential basis vectors are negated.
    let facing = step(0.f, dot(v, ng)) * 2.f - 1.f;
    t *= facing;
    b *= facing;
    ng *= facing;

    // Compute pertubed normals:
    var n: vec3f;
    if(material.normalUVSet >= 0) {
        n = textureSample(normalTexture, normalSampler, UV).rgb * 2.f - vec3(1.f);
        n *= vec3(material.normalScale, material.normalScale, 1.f);
        n = mat3x3(t, b, ng) * normalize(n);
    } else {
        n = ng;
    }

    return NormalInfo(
        ng,
        t,
        b,
        n,
    );
}

struct MaterialInfo {
    perceptualRoughness: f32,      // roughness value, as authored by the model creator (input to shader)
    f0: vec3f,                        // full reflectance color (n incidence angle)

    alphaRoughness: f32,           // roughness mapped to a more linear change in the roughness (proposed by [2])
    albedoColor: vec3f,

    f90: vec3f,                       // reflectance color at grazing angle
    metallic: f32,

    n: vec3f,
    baseColor: vec3f, // getBaseColor()
}

fn getMetallicRoughnessInfo(vertex: FragmentInput, in_info: MaterialInfo, f0_ior: f32) -> MaterialInfo{
    var info = in_info;
    info.metallic = material.metallicFactor;
    info.perceptualRoughness = material.roughnessFactor;

    if(material.metallicRoughnessUVSet >= 0) {
        let uv = select(vertex.texCoord1, vertex.texCoord0, material.metallicRoughnessUVSet == 0);
        // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
        // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
        let mrSample = textureSample(metallic_roughnessTexture, metallic_roughnessSampler, uv);
        info.perceptualRoughness *= mrSample.g;
        info.metallic *= mrSample.b;
    }

    // Achromatic f0 based on IOR.
    let f0 = vec3(f0_ior);

    info.albedoColor = mix(info.baseColor.rgb * (vec3(1.0) - f0), vec3(0.), info.metallic);
    info.f0 = mix(f0, info.baseColor.rgb, info.metallic);

    return info;
}

fn getIBLRadianceGGX(n: vec3f, v: vec3f, perceptualRoughness: f32, specularColor: vec3f) -> vec3f{
    let NdotV = clampedDot(n, v);
    let reflection = normalize(reflect(-v, n));
    let brdfSamplePoint = clamp(vec2(NdotV, perceptualRoughness), vec2(0.0, 0.0), vec2(1.0, 1.0));
    let brdf = textureSample(lut_ggxTexture, lut_ggxSampler, brdfSamplePoint).rg;
    let lod = clamp(perceptualRoughness * f32(material.radianceMipCount), 0.0, f32(material.radianceMipCount));
    let specularSample = textureSampleLevel(specularTexture, specularSampler, reflection, lod);
    let specularLight = specularSample.rgb;
    return specularLight * (specularColor * brdf.x + brdf.y);
}

fn getIBLRadianceLambertian(n: vec3f, diffuseColor: vec3f) -> vec3f{
    let diffuseLight = textureSample(diffuseTexture, diffuseSampler, n).rgb;
    return diffuseLight * diffuseColor;
}

// sRGB
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

// packing
fn packNormalAndDeviation(normal: vec3f, deviation: f32) -> vec2<u32>{
    return vec2(pack2x16float(normal.xy), pack2x16float(vec2(normal.z, deviation)));
}

fn packNormal(normal: vec3f) -> vec2<u32>{
    return packNormalAndDeviation(normal, 0.f);
}

@fragment
fn fragmentMain(vertex: FragmentInput) -> FragmentOutput {
    var baseColor = material.baseColorFactor * vertex.color0;

    if(material.baseColorUVSet >= 0) {
        let uv = select(vertex.texCoord1, vertex.texCoord0, material.baseColorUVSet < 1);
        let bc = textureSample(base_colorTexture, base_colorSampler, uv);
        baseColor *= vec4(sRGBToLinearComplex(bc.rgb), bc.a);
    }
    if(baseColor.a < material.alphaCutoff) {
        discard;
    }

    let v = normalize(vertex.toCamera);
    let normalInfo = getNormalInfo(vertex, v);
    let n = normalInfo.n;
    let normal = normalInfo.n;
    // vec3 l = normalize(uSunDir);   // Direction from surface point to light
    // vec3 h = normalize(l + v);     // Direction of the vector between l and v, called halfway vector

    var outColor: vec4f;

if(PBR_METALLIC_ROUGHNESS) {
    var materialInfo: MaterialInfo;
    materialInfo.baseColor = baseColor.rgb;

    // The default index of refraction of 1.5 yields a dielectric normal incidence reflectance of 0.04.
    let ior = 1.5f;
    let f0_ior = 0.04f;

    materialInfo = getMetallicRoughnessInfo(vertex, materialInfo, f0_ior);

    materialInfo.perceptualRoughness = clamp(materialInfo.perceptualRoughness, 0.0f, 1.0f);
    materialInfo.metallic = clamp(materialInfo.metallic, 0.0f, 1.0f);

    // Roughness is authored as perceptual roughness; as is convention,
    // convert to material roughness by squaring the perceptual roughness.
    materialInfo.alphaRoughness = materialInfo.perceptualRoughness * materialInfo.perceptualRoughness;

    // Compute reflectance.
    let reflectance = max(max(materialInfo.f0.r, materialInfo.f0.g), materialInfo.f0.b);

    // Anything less than 2% is physically impossible and is instead considered to be shadowing. Compare to "Real-Time-Rendering" 4th editon on page 325.
    materialInfo.f90 = vec3(clamp(reflectance * 50.0f, 0.0f, 1.0f));

    materialInfo.n = n;

    // LIGHTING
    let f_specular = getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0);
    let f_diffuse = getIBLRadianceLambertian(n, materialInfo.albedoColor);

    // float NdotL = clampedDot(n, l);
    // float NdotV = clampedDot(n, v);
    // float NdotH = clampedDot(n, h);
    // float LdotH = clampedDot(l, h);
    // float VdotH = clampedDot(v, h);

    // vec3 intensity = vec3(uSunBrightness);

    // if(NdotL > 0.0 || NdotV > 0.0) {
    //     // Calculation of analytical light
    //     //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#acknowledgments AppendixB
    //     f_specular += intensity * NdotL * BRDF_specularGGX(materialInfo.f0, materialInfo.f90, materialInfo.alphaRoughness, VdotH, NdotL, NdotV, NdotH);
    //     f_diffuse += intensity * NdotL * BRDF_lambertian(materialInfo.f0, materialInfo.f90, materialInfo.albedoColor, VdotH);
    // }

    var f_emissive = material.emissiveFactor;
    if(material.emissiveUVSet >= 0) {
        let uv = select(vertex.texCoord1, vertex.texCoord0, material.emissiveUVSet == 0);
        f_emissive *= sRGBToLinear(textureSample(emissiveTexture, emissiveSampler, uv).rgb);
    }

    var color = (f_emissive + f_diffuse + f_specular) + ambientLight * materialInfo.albedoColor;

    // Apply optional PBR terms for additional (optional) shading
    if(material.occlusionUVSet >= 0) {
        let uv = select(vertex.texCoord1, vertex.texCoord0, material.occlusionUVSet == 0);
        let ao = textureSample(occlusionTexture, occlusionSampler, uv).r;
        color = mix(color, color * ao, material.occlusionStrength);
    }

    outColor = vec4(color, baseColor.a);
}else{
    outColor = baseColor;
}

    // only write to pick buffers for opaque triangles (for devices without OES_draw_buffers_indexed support)
    var pick: vec4u;
    if(outColor.a >= 0.99f) {
//TODO
// #if defined (ADRENO600)
//         pick = uvec4(combineMediumP(vertexFlat.objectId_high, vertexFlat.objectId_low), packNormal(normal), floatBitsToUint(vertex.linearDepth));
// #else
        pick = vec4(vertex.objectId, packNormal(normal), bitcast<u32>(vertex.linearDepth));
// #endif
    }

    return FragmentOutput(
        outColor,
        pick,
    );
}