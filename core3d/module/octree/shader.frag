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
in Varyings varyings;

// struct VaryingsFlat {
//     vec4 color;
//     uint objectId;
// };
// flat in VaryingsFlat varyingsFlat;

layout(location = 0) out vec4 color;
layout(location = 1) out vec2 normal;
layout(location = 2) out float linearDepth;
layout(location = 3) out uvec2 info;

void main() {
    color = varyings.color;
    normal = varyings.normal.xy;
    linearDepth = varyings.linearDepth;
    info = uvec2(floatBitsToUint(varyings.objectId), 0);
}
