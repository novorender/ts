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
in Varyings varyings;

#ifndef IOS_WORKAROUND
struct VaryingsFlat {
    vec4 color;
    uint objectId;
};
flat in VaryingsFlat varyingsFlat;
#endif

layout(location = 0) out vec4 color;
layout(location = 1) out vec2 normal;
layout(location = 2) out float linearDepth;
layout(location = 3) out uvec2 info;

void main() {
    normal = normalize(varyings.normal).xy;
    linearDepth = varyings.linearDepth;
#ifdef IOS_WORKAROUND
    color = varyings.color;
    uint objectId = uint(varyings.objectId[0]) | uint(varyings.objectId[1]) << 16U;
    info = uvec2(objectId, 0);
#else
    color = varyingsFlat.color;
    info = uvec2(varyingsFlat.objectId, 0);
#endif

}
