layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Octree {
    mat4 objectClipMatrix;
} octree;

in vec3 normal;
out vec4 fragColor;

void main() {
    fragColor = vec4(normal * .5 + .5, 1);
}
