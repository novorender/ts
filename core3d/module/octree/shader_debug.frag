layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

layout(std140) uniform Node {
    NodeUniforms node;
};

layout(std140) uniform Mesh {
    MeshUniforms mesh;
};

uniform OctreeTextures textures;

struct VaryingsFlat {
    vec4 color;
};
flat in VaryingsFlat varyingsFlat;

layout(location = 0) out vec4 color;

void main() {
    color = varyingsFlat.color;
}
