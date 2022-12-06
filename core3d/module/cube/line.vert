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

layout(location = 0) in vec2 position;

void main() {
    gl_Position = camera.viewClipMatrix * vec4(position.xy, -cube.clipDepth, 1);
}
