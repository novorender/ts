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
flat in VaryingsFlat varyingsFlat;

layout(location = 0) out mediump vec4 color;

void main() {
    color = varyingsFlat.color;
}
