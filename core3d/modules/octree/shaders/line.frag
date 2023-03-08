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
    float opacity;
} varyings;

flat in struct {
    uint objectId;
} varyingsFlat;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out float fragLinearDepth;
layout(location = 2) out uvec2 fragInfo;

void main() {
    if(clip(varyings.positionVS, clipping))
        discard;

    fragColor = vec4(scene.nearOutlineColor, varyings.opacity);
    fragLinearDepth = -varyings.positionVS.z;
    fragInfo = uvec2(varyingsFlat.objectId, 0);
}
