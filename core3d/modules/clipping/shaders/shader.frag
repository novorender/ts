layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Colors {
    ClippingColors visualization;
};

in ClippingVaryings varyings;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out uvec4 fragPick;

void main() {
    mediump vec3 dir = normalize(varyings.dirVS);
    float rangeT[2] = float[](0.f, 1000000.f); // min, max T
    uint idx[2] = uint[](undefinedIndex, undefinedIndex);
    float s = clipping.mode == 0U ? 1.f : -1.f;
    for(uint i = 0U; i < clipping.numPlanes; i++) {
        highp vec4 plane = clipping.planes[i];
        highp vec3 normal = plane.xyz;
        highp float offset = plane.w;
        highp float denom = dot(dir, normal);
        if(abs(denom) > 0.f) {
            float t = -offset / denom;
            if(denom * s > 0.f) {
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
    lowp uint i = clipping.mode == 0U ? 1U : 0U;
    if(idx[i] == undefinedIndex || rangeT[1] < rangeT[0])
        discard;
    highp vec4 posVS = vec4(dir * rangeT[i], 1.f);
    highp vec4 posCS = camera.viewClipMatrix * posVS;
    highp float ndcDepth = (posCS.z / posCS.w);
    gl_FragDepth = (gl_DepthRange.diff * ndcDepth + gl_DepthRange.near + gl_DepthRange.far) / 2.f;
    mediump vec4 rgba = visualization.colors[idx[i]];
    highp uint objectId = clippingId + idx[i];
    if(rgba.a == 0.f)
        discard;
    fragColor = rgba;
    mediump vec3 normal = camera.viewLocalMatrixNormal * clipping.planes[idx[i]].xyz;
    highp float linearDepth = -posVS.z;
    fragPick = uvec4(objectId, packNormal(normal), floatBitsToUint(linearDepth));
}
