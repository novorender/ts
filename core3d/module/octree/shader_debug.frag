layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Octree {
    mat4 objectClipMatrix;
    vec4 debugColor;
} octree;

in vec4 color;
out vec4 fragColor;

void main() {
    fragColor = color;
}
