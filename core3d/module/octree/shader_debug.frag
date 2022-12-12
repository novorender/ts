layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Materials {
    uvec4 rgba[64];
} materials;

layout(std140) uniform Scene {
    mat4 localViewMatrix;
} scene;

layout(std140) uniform Node {
    mat4 modelLocalMatrix;
    vec4 debugColor;
    vec3 min;
    vec3 max;
} node;

struct VaryingsFlat {
    vec4 color;
};
flat in VaryingsFlat varyingsFlat;

layout(location = 0) out vec4 color;

void main() {
    color = varyingsFlat.color;
}
