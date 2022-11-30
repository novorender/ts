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
    mat4 modelViewMatrix;
    vec4 debugColor;
} node;

struct VaryingsFlat {
    vec4 color;
};
flat in VaryingsFlat varyingsFlat;

layout(location = 0) out vec4 color;

void main() {
    color = varyingsFlat.color;
}
