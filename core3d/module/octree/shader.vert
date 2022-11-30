layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Materials {
    uvec4 rgba[64];
} materials;

layout(std140) uniform Node {
    mat4 modelViewMatrix;
    vec4 debugColor;
} node;

struct Varyings {
    vec3 normal;
    float linearDepth;
#ifdef IOS_WORKAROUND
    vec4 color;
    vec2 objectId; // older (<A15) IOS and Ipads crash if we use uint here, so we use two floats instead
#endif
};
out Varyings varyings;

#ifndef IOS_WORKAROUND
struct VaryingsFlat {
    vec4 color;
    uint objectId;
};
flat out VaryingsFlat varyingsFlat;
#endif

layout(location = 0) in vec4 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in uint material;
layout(location = 3) in uint objectId;

void main() {
    vec4 posVS = node.modelViewMatrix * position;
    gl_Position = camera.viewClipMatrix * posVS;
    varyings.normal = normal;
    varyings.linearDepth = -posVS.z;
    uint rgba = materials.rgba[material / 4U][material % 4U];
    vec4 unpack = vec4(float((rgba >> 0) & 0xffU), float((rgba >> 8) & 0xffU), float((rgba >> 16) & 0xffU), float((rgba >> 24) & 0xffU));
#ifdef IOS_WORKAROUND
    varyings.color = unpack / 255.0;
    varyings.objectId = vec2(objectId & 0xffffU, objectId >> 16U) + 0.5;
#else
    varyingsFlat.color = unpack / 255.0;
    varyingsFlat.objectId = objectId;
#endif
}
