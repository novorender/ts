layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

layout(location = 0) in vec2 vertexPosition;

void main() {
    gl_Position = camera.viewClipMatrix * vec4(vertexPosition.xy, -camera.near, 1);
}
