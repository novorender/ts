layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

layout(location = 0) out vec4 fragColor;

void main() {
    fragColor = vec4(scene.nearOutlineColor, 1);
}
