layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

in struct {
    vec3 positionVS;
} varyings;

layout(location = 0) out vec4 fragColor;

void main() {
    if(clip(varyings.positionVS, clipping))
        discard;

    fragColor = vec4(scene.nearOutlineColor, 1);
}
