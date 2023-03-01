layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

layout(location = 0) in vec2 vertexPosition;

out struct {
    vec3 positionVS;
} varyings;

void main() {
    vec3 posVS = vec3(vertexPosition.xy, -camera.near);
    varyings.positionVS = posVS;
    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);
}
