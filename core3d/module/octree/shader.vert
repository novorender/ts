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
    mat4 objectClipMatrix;
    vec4 debugColor;
} node;

in vec4 vertexPosition;
in vec3 vertexNormal;
in uint material;
out vec3 normal;
out vec4 color;

void main() {
    gl_Position = node.objectClipMatrix * vertexPosition;
    normal = vertexNormal;
    uint rgba = materials.rgba[material / 4U][material % 4U];
    // vec4 unpack = vec4(float((rgba >> 24) & 0xffU), float((rgba >> 16) & 0xffU), float((rgba >> 8) & 0xffU), float((rgba >> 0) & 0xffU));
    vec4 unpack = vec4(float((rgba >> 0) & 0xffU), float((rgba >> 8) & 0xffU), float((rgba >> 16) & 0xffU), float((rgba >> 24) & 0xffU));
    color = unpack / 255.0;
    // color = vec4(normal * .5 + .5, 0.1);
}
