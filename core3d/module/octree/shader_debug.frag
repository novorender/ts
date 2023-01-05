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
flat in VaryingsFlat varyingsFlat;

layout(location = 0) out vec4 color;

void main() {
    color = varyingsFlat.color;
}
