layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Clipping {
    vec4 planes[6];
    vec4 colors[6];
    uint numPlanes;
    uint mode; // 0 = intersection, 1 = union
} clipping;

layout(std140) uniform Cube {
    mat4 modelViewMatrix;
    float clipDepth;
} cube;

in struct {
    vec3 posVS;
    vec3 normal;
    vec3 color;
    float linearDepth;
} varyings;

layout(location = 0) out vec4 color;
layout(location = 1) out vec2 normal;
layout(location = 2) out float linearDepth;
layout(location = 3) out uvec2 info;

const uint modeIntersection = 0U;
const uint cubeId = 0xfffffff8U;

bool clip(vec3 point) {
    float s = clipping.mode == modeIntersection ? -1. : 1.;
    bool inside = clipping.mode == modeIntersection ? clipping.numPlanes > 0U : true;
    for(uint i = 0U; i < clipping.numPlanes; i++) {
        inside = inside && dot(vec4(point, 1), clipping.planes[i]) * s < 0.;
    }
    return clipping.mode == modeIntersection ? inside : !inside;
}

void main() {
    if(varyings.linearDepth < cube.clipDepth || clip(varyings.posVS))
        discard;
    color = vec4(varyings.color, 1);
    normal = normalize(varyings.normal).xy;
    linearDepth = varyings.linearDepth;
    info = uvec2(cubeId, 0);
}
