layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Clipping {
    vec4 planes[6];
    uint numPlanes;
    uint mode; // 0 = intersection, 1 = union
} clipping;

layout(std140) uniform Cube {
    mat4 modelViewMatrix;
    float clipDepth;
} cube;

layout(location = 0) in vec2 position;

void main() {
    gl_Position = camera.viewClipMatrix * vec4(position.xy, -cube.clipDepth, 1);
}
