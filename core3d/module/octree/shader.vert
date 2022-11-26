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

in vec4 vertexPosition;
in vec3 vertexNormal;
out vec3 normal;

void main() {
    gl_Position = octree.objectClipMatrix * vertexPosition;
    normal = vertexNormal;
}
