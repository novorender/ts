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
    float s = clipping.mode == clippingModeIntersection ? -1.f : 1.f;
    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;
    for(uint i = 0u; i < clipping.numPlanes; i++) {
        inside = inside && int(i) != outline.planeIndex && dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.f;
        }
    if(clipping.mode == clippingModeIntersection ? inside : !inside) {
        discard;
    }

    fragColor = vec4(outline.color, varyings.opacity);
    float linearDepth = -varyings.positionVS.z;
    fragPick = uvec4(varyingsFlat.objectId, 0, 0, floatBitsToUint(linearDepth));
}
