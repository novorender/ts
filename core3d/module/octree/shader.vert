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

struct Varyings {
    vec3 normal;
    vec4 color;
};
out Varyings varyings;

layout(location = 0) in vec4 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in uint material;

void main() {
    gl_Position = node.objectClipMatrix * position;
    varyings.normal = normal;
    uint rgba = materials.rgba[material / 4U][material % 4U];
    vec4 unpack = vec4(float((rgba >> 0) & 0xffU), float((rgba >> 8) & 0xffU), float((rgba >> 16) & 0xffU), float((rgba >> 24) & 0xffU));
    varyings.color = unpack / 255.0;
    // varyings.color = vec4(normal * .5 + .5, 0.1);
}
