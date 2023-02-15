layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

in ClippingVaryings varyings;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out float fragLinearDepth;
layout(location = 2) out uvec2 fragInfo;

void main() {
    vec3 dir = normalize(varyings.dirVS);
    float rangeT[2] = float[](0., 1000000.); // min, max T
    uint idx[2] = uint[](undefinedIndex, undefinedIndex);
    float s = clipping.mode == 0U ? 1. : -1.;
    for(uint i = 0U; i < clipping.numPlanes; i++) {
        vec4 plane = clipping.planes[i];
        vec3 normal = plane.xyz;
        float offset = plane.w;
        float denom = dot(dir, normal);
        if(abs(denom) > 0.) {
            float t = -offset / denom;
            if(denom * s > 0.) {
                // back facing
                if(rangeT[0] < t) {
                    rangeT[0] = t;
                    idx[0] = i;
                }
            } else {
                // front facing
                if(rangeT[1] > t) {
                    rangeT[1] = t;
                    idx[1] = i;
                }
            }
        }
    }
    uint i = clipping.mode == 0U ? 1U : 0U;
    if(idx[i] == undefinedIndex || rangeT[1] < rangeT[0])
        discard;
    vec4 posVS = vec4(dir * rangeT[i], 1.);
    vec4 posCS = camera.viewClipMatrix * posVS;
    float ndcDepth = (posCS.z / posCS.w);
    gl_FragDepth = (gl_DepthRange.diff * ndcDepth + gl_DepthRange.near + gl_DepthRange.far) / 2.;
    vec4 rgba = clipping.colors[idx[i]];
    uint objectId = clippingId + idx[i];
    if(rgba.a == 0.)
        discard;
    fragColor = rgba;
    fragLinearDepth = -posVS.z;
    fragInfo = uvec2(objectId, packNormal(clipping.planes[idx[i]].xy));
}
