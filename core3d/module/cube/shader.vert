layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
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

out struct {
    vec3 posVS;
    vec3 normal;
    vec3 color;
    float linearDepth;
} varyings;

layout(location = 0) in vec4 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec3 color;

void main() {
    vec4 posVS = cube.modelViewMatrix * position;
    gl_Position = camera.viewClipMatrix * posVS;
    varyings.posVS = posVS.xyz;
    varyings.normal = camera.worldViewMatrixNormal * normal;
    varyings.color = color;
    varyings.linearDepth = -posVS.z;
}
