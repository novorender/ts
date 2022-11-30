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
    vec4 color;
    float linearDepth;
    float objectId; // older (<A15) IOS and Ipads crash if we use uint here, so we pack the bits as float and hope no bits are lost/changed during interpolation
};
out Varyings varyings;

// struct VaryingsFlat {
//     vec4 color;
//     uint objectId;
// };
// flat out VaryingsFlat varyingsFlat;

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
    varyings.color = unpack / 255.0;
    varyings.objectId = uintBitsToFloat(objectId);
}
