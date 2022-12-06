layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Cube {
    mat4 modelViewMatrix;
    float clipDepth;
} cube;

in struct {
    vec3 normal;
    vec3 color;
    float linearDepth;
} varyings;

layout(location = 0) out vec4 color;
layout(location = 1) out vec2 normal;
layout(location = 2) out float linearDepth;

void main() {
    if(varyings.linearDepth < cube.clipDepth)
        discard;
    color = vec4(varyings.color, 1);
    normal = normalize(varyings.normal).xy;
    linearDepth = varyings.linearDepth;
}
