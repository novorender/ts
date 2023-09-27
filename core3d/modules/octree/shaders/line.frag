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
    vec4 color;
} varyings;

flat in struct {
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
} varyingsFlat;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out uvec4 fragPick;

void main() {
    float s = clipping.mode == clippingModeIntersection ? -1.f : 1.f;
    bool inside = clipping.mode == clippingModeIntersection ? (clipping.numPlanes + (outline.planeIndex >= 0 ? 1u : 0u) ) > 0U : true;
    for(uint i = 0u; i < clipping.numPlanes; i++) {
        if (int(i) == outline.planeIndex) {
            inside = inside && clipping.mode != clippingModeIntersection;
        } else {
            inside = inside && dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.f;
        }
    }
    if(clipping.mode == clippingModeIntersection ? inside : !inside) {
        discard;
    }

    fragColor = varyings.color;
    float linearDepth = -varyings.positionVS.z;
#if defined (ADRENO600)
    highp uint objectId = combineMediumP(varyingsFlat.objectId_high, varyingsFlat.objectId_low) | (1u << 31);
    fragPick = uvec4(objectId, 0, 0, floatBitsToUint(linearDepth));
#else
    uint lineObjectId = varyingsFlat.objectId | (1u << 31);
    fragPick = uvec4(lineObjectId, packNormalAndDeviation(vec3(0), 0.), floatBitsToUint(linearDepth));
#endif
}
