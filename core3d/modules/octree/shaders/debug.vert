layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

layout(std140) uniform Node {
    NodeUniforms node;
};

uniform OctreeTextures textures;

struct VaryingsFlat {
    vec4 color;
};
flat out VaryingsFlat varyingsFlat;

const lowp int ccwIndices[12] = int[12](0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2);
const lowp int cwIndices[12] = int[12](0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3);
const lowp vec3 corners[8] = vec3[8](vec3(-1, -1, -1), vec3(-1, 1, 1), vec3(1, -1, 1), vec3(1, 1, -1), vec3(-1, -1, 1), vec3(-1, 1, -1), vec3(1, -1, -1), vec3(1, 1, 1));

void main() {
    lowp vec3 corner = corners[gl_VertexID / 12];
    highp vec3 pos = corner;
    pos = (pos + 1.f) / 2.f;
    pos = mix(node.min, node.max, pos);
    lowp int idx = (gl_VertexID / 12) < 4 ? cwIndices[gl_VertexID % 12] : ccwIndices[gl_VertexID % 12];
    varyingsFlat.color = node.debugColor;
    if(idx > 0) {
        vec3 extents = abs(node.max - node.min);
        float minExtent = min(extents[0], min(extents[1], extents[2]));
        pos[idx - 1] -= corner[idx - 1] * minExtent * .1f;
        varyingsFlat.color.rgb *= 0.75f;
    }
    vec4 posVS = camera.localViewMatrix * vec4(pos, 1);
    gl_Position = camera.viewClipMatrix * posVS;
}
