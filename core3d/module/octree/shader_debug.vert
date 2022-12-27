layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

const uint maxHighlights = 256U;

layout(std140) uniform Node {
    mat4 modelLocalMatrix;
    vec4 debugColor;
    vec3 min;
    vec3 max;
} node;

struct VaryingsFlat {
    vec4 color;
};
flat out VaryingsFlat varyingsFlat;

const float size = 0.9;
const int ccwIndices[12] = int[12](0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2);
const int cwIndices[12] = int[12](0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3);
const vec3 corners[8] = vec3[8](vec3(-1, -1, -1), vec3(-1, 1, 1), vec3(1, -1, 1), vec3(1, 1, -1), vec3(-1, -1, 1), vec3(-1, 1, -1), vec3(1, -1, -1), vec3(1, 1, 1));

void main() {
    vec3 pos = corners[gl_VertexID / 12];
    pos = (pos + 1.) / 2.;
    pos = mix(node.min, node.max, pos);
    int idx = (gl_VertexID / 12) < 4 ? cwIndices[gl_VertexID % 12] : ccwIndices[gl_VertexID % 12];
    varyingsFlat.color = node.debugColor;
    if(idx > 0) {
        pos[idx - 1] *= size;
        varyingsFlat.color.rgb *= 0.75;
    }
    vec4 posVS = camera.localViewMatrix * node.modelLocalMatrix * vec4(pos, 1);
    gl_Position = camera.viewClipMatrix * posVS;
}
