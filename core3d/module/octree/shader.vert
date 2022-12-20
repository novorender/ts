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

layout(std140) uniform Node {
    mat4 modelLocalMatrix;
    vec4 debugColor;
    vec3 min;
    vec3 max;
} node;

out struct {
    vec3 positionVS; // view space
    vec3 normalWS; // world space
    vec3 normalVS; // view space
    vec2 texCoord0;
    float linearDepth;
#ifdef IOS_WORKAROUND
    vec4 color;
    vec2 objectId; // older (<A15) IOS and Ipads crash if we use uint here, so we use two floats instead
#endif
} varyings;

#ifndef IOS_WORKAROUND
flat out struct {
    vec4 color;
    uint objectId;
} varyingsFlat;
#endif

layout(location = 0) in vec4 position;
#ifndef POS_ONLY
layout(location = 1) in vec3 normal;
layout(location = 2) in uint material;
layout(location = 3) in uint objectId;
layout(location = 4) in vec2 texCoord0;
layout(location = 5) in vec4 color0;
layout(location = 6) in float intensity;
layout(location = 7) in float deviation;
#else
const vec3 normal = vec3(0);
const uint material = uint(0);
const uint objectId = uint(0);
const vec2 texCoord0 = vec2(0);
const vec4 color0 = vec4(0);
const float intensity = 0.;
const float deviation = 0.;
#endif

void main() {
    vec4 posVS = camera.localViewMatrix * node.modelLocalMatrix * position;
    gl_Position = camera.viewClipMatrix * posVS;
    gl_PointSize = 1.; // TODO: set properly...
    varyings.positionVS = posVS.xyz;
    varyings.normalWS = normal;
    varyings.normalVS = camera.worldViewMatrixNormal * normal;
    varyings.texCoord0 = texCoord0;
    varyings.linearDepth = -posVS.z;
    uint rgba = material == 0xffU ? 0U : materials.rgba[material / 4U][material % 4U];
    vec4 unpack = vec4(float((rgba >> 0) & 0xffU), float((rgba >> 8) & 0xffU), float((rgba >> 16) & 0xffU), float((rgba >> 24) & 0xffU));
#if defined(IOS_WORKAROUND)
    varyings.color = unpack / 255.0;
    varyings.objectId = vec2(objectId & 0xffffU, objectId >> 16U) + 0.5;
#else
    varyingsFlat.color = unpack / 255.0;
    varyingsFlat.objectId = objectId;
#endif
}
