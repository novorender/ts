layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

in struct {
    highp vec3 positionVS;
    mediump vec2 uv;
    mediump float radius;
} varyings;

flat in struct {
    mediump vec4 color;
    mediump float len;
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
} varyingsFlat;

layout(location = 0) out mediump vec4 fragColor;
layout(location = 1) out highp uvec4 fragPick;

void main() {
    if (varyingsFlat.color.a == 0.) {
        discard;
    }


#if defined(SLOW_RECOMPILE)
    lowp float s = clipping.mode == clippingModeIntersection ? -1.f : 1.f;
    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;
    for(lowp uint i = 0U; i < clipping.numPlanes; i++) {
        if(int(i) == outline.planeIndex) {
            inside = inside && clipping.mode != clippingModeIntersection;
        } else {
            inside = inside && dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.f;
        }
    }
    if(clipping.mode == clippingModeIntersection ? inside : !inside) {
        discard;
    }
#endif
#if (NUM_CLIPPING_PLANES > 0)
    lowp float s = clipping.mode == clippingModeIntersection ? -1. : 1.;
    if(clipping.mode == clippingModeIntersection) {
        bool isInside = false;
        for(int i = 0; i < NUM_CLIPPING_PLANES; i++) {
            bool inside = dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.f;
            if(!inside) {
                isInside = true;
            }
        }
        if(!isInside) {
            discard;
        }
    } else {
        for(int i = 0; i < NUM_CLIPPING_PLANES; i++) {
            if (int(i) != outline.planeIndex) {
                bool inside = dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.f;
                if(!inside) {
                    discard;
                }
            }

        }

    }
#endif

    float pixelRadius = varyings.radius;
    vec2 uv = varyings.uv;
    if(uv.x > 0.)
        uv.x = max(0., uv.x - varyingsFlat.len);
    float l = length(uv);
    if(l > pixelRadius)
        discard;

    float a = min(2., (pixelRadius - l)); // add one pixel alpha/AA slope
    fragColor = vec4(varyingsFlat.color.rgb, varyingsFlat.color.a * a);
    float linearDepth = -varyings.positionVS.z;
#if defined (ADRENO600)
    highp uint objectId = combineMediumP(varyingsFlat.objectId_high, varyingsFlat.objectId_low) | (1u << 31);
    fragPick = uvec4(objectId, 0, 0, floatBitsToUint(linearDepth));
#else
    uint lineObjectId = varyingsFlat.objectId | (1u << 31);
    fragPick = uvec4(lineObjectId, packNormalAndDeviation(vec3(0), 0.), floatBitsToUint(linearDepth));
#endif
}
