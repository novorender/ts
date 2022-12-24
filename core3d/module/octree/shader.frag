layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Materials {
    uvec4 rgba[64];
} materials;

const uint maxHighlights = 8U;
struct HighlightMatrix {
    mat4 transform;
    vec4 translate;
};
layout(std140) uniform Highlights {
    HighlightMatrix matrix[maxHighlights];
} highlights;

layout(std140) uniform Node {
    mat4 modelLocalMatrix;
    vec4 debugColor;
    vec3 min;
    vec3 max;
} node;

in struct {
    vec3 positionVS; // view space
    vec3 normalWS; // world spaec
    vec3 normalVS; // view space
    vec2 texCoord0;
    float linearDepth;
#ifdef IOS_WORKAROUND
    vec4 color;
    vec2 objectId; // older (<A15) IOS and Ipads crash if we use uint here, so we use two floats instead
    float highlight;
#endif
} varyings;

#ifndef IOS_WORKAROUND
flat in struct {
    vec4 color;
    uint objectId;
    uint highlight;
} varyingsFlat;
#endif

layout(location = 0) out vec4 color;
layout(location = 1) out vec2 normal;
layout(location = 2) out float linearDepth;
layout(location = 3) out uvec2 info;

uniform sampler2D texture_base_color;
uniform samplerCube texture_ibl_diffuse;
uniform samplerCube texture_ibl_specular;

const mat4 ditherThresholds = mat4(0.0 / 16.0, 8.0 / 16.0, 2.0 / 16.0, 10.0 / 16.0, 12.0 / 16.0, 4.0 / 16.0, 14.0 / 16.0, 6.0 / 16.0, 3.0 / 16.0, 11.0 / 16.0, 1.0 / 16.0, 9.0 / 16.0, 15.0 / 16.0, 7.0 / 16.0, 13.0 / 16.0, 5.0 / 16.0);

float dither(vec2 xy) {
    int x = int(xy.x) & 3;
    int y = int(xy.y) & 3;
    return ditherThresholds[y][x];
}

const float GAMMA = 2.2;
const float INV_GAMMA = 1.0 / GAMMA;
const float uMipCount = 9.; // TODO: Get from uniform buffer instead

// sRGB to linear approximation
// see http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
vec3 sRGBToLinear(vec3 srgbIn) {
    return vec3(pow(srgbIn.xyz, vec3(GAMMA)));
}

void main() {
    vec4 baseColor;
    uint objectId;
    uint highlight;
#if defined(IOS_WORKAROUND)
    baseColor = varyings.color;
    objectId = uint(varyings.objectId[0]) | uint(varyings.objectId[1]) << 16U;
    highlight = uint(round(varyings.highlight));
#else
    baseColor = varyingsFlat.color;
    objectId = varyingsFlat.objectId;
    highlight = varyingsFlat.highlight;
#endif

    vec4 rgba;
    if(baseColor == vec4(0)) {
        rgba = texture(texture_base_color, varyings.texCoord0);
    } else {
        vec4 diffuseOpacity = baseColor;
        diffuseOpacity.rgb = sRGBToLinear(diffuseOpacity.rgb);

        vec4 specularShininess = vec4(mix(0.4, 0.1, baseColor.a)); // TODO: get from varyings instead
        specularShininess.rgb = sRGBToLinear(specularShininess.rgb);

        vec3 V = camera.viewWorldMatrixNormal * normalize(varyings.positionVS);
        vec3 N = normalize(gl_FrontFacing ? varyings.normalWS : -varyings.normalWS);

        vec3 irradiance = texture(texture_ibl_diffuse, N).rgb;
        float perceptualRoughness = clamp((1.0 - specularShininess.a), 0.0, 1.0);
        perceptualRoughness *= perceptualRoughness;
        float lod = perceptualRoughness * (uMipCount - 1.0);
        vec3 reflection = textureLod(texture_ibl_specular, reflect(V, N), lod).rgb;

        vec3 rgb = diffuseOpacity.rgb * irradiance + specularShininess.rgb * reflection;
        rgba = vec4(rgb, baseColor.a);
    }

    if(highlight != 0U) {
        HighlightMatrix mtx = highlights.matrix[int(highlight) - 1];
        rgba = mtx.transform * rgba + mtx.translate;
    }

    // we put discards here (late) to avoid problems with derivative functions
    if(rgba.a == 0.)
        discard;

    if((rgba.a - 0.5 / 16.0) < dither(gl_FragCoord.xy))
        discard;

    color = rgba;
    normal = normalize(varyings.normalVS).xy;
    linearDepth = varyings.linearDepth;
    info = uvec2(objectId, 0);
}
