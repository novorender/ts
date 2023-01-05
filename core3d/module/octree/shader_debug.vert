layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 localViewMatrixNormal;
    mat3 viewLocalMatrixNormal;
    vec2 viewSize;
} camera;

layout(std140) uniform Scene {
    bool applyDefaultHighlight;
    float iblMipCount;
    // point cloud
    float pixelSize;
    float maxPixelSize;
    float metricSize;
    float toleranceFactor;
    uint deviationMode;
    vec2 deviationRange;
    // terrain elevation
    vec2 elevationRange;
} scene;

layout(std140) uniform Node {
    mat4 modelLocalMatrix;
    float tolerance;
    vec4 debugColor;
    // min,max are in local space
    vec3 min;
    vec3 max;
} node;

const uint MeshMode_Triangles = 0U;
const uint MeshMode_Points = 1U;
layout(std140) uniform Mesh {
    uint mode; // MeshMode
} mesh;

struct VaryingsFlat {
    vec4 color;
};
flat out VaryingsFlat varyingsFlat;

const int ccwIndices[12] = int[12](0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2);
const int cwIndices[12] = int[12](0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3);
const vec3 corners[8] = vec3[8](vec3(-1, -1, -1), vec3(-1, 1, 1), vec3(1, -1, 1), vec3(1, 1, -1), vec3(-1, -1, 1), vec3(-1, 1, -1), vec3(1, -1, -1), vec3(1, 1, 1));

void main() {
    vec3 corner = corners[gl_VertexID / 12];
    vec3 pos = corner;
    pos = (pos + 1.) / 2.;
    pos = mix(node.min, node.max, pos);
    int idx = (gl_VertexID / 12) < 4 ? cwIndices[gl_VertexID % 12] : ccwIndices[gl_VertexID % 12];
    varyingsFlat.color = node.debugColor;
    if(idx > 0) {
        vec3 extents = abs(node.max - node.min);
        float minExtent = min(extents[0], min(extents[1], extents[2]));
        pos[idx - 1] -= corner[idx - 1] * minExtent * .1;
        varyingsFlat.color.rgb *= 0.75;
    }
    vec4 posVS = camera.localViewMatrix * vec4(pos, 1);
    gl_Position = camera.viewClipMatrix * posVS;
}
