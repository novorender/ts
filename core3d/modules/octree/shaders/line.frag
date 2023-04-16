layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

layout(std140) uniform Node {
    NodeUniforms node;
};

in struct {
    vec3 positionVS;
    float opacity;
} varyings;

flat in struct {
    uint objectId;
} varyingsFlat;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out uvec4 fragPick;

void main() {
    if(clipOutlines(varyings.positionVS, clipping))
        discard;

    fragColor = vec4(outline.color, varyings.opacity);
    float linearDepth = -varyings.positionVS.z;
    fragPick = uvec4(varyingsFlat.objectId, 0, 0, floatBitsToUint(linearDepth));
}
