layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 localViewMatrixNormal;
    mat3 viewLocalMatrixNormal;
    vec2 viewSize;
} camera;

layout(std140) uniform Clipping {
    vec4 planes[6];
    vec4 colors[6];
    uint numPlanes;
    uint mode; // 0 = intersection, 1 = union
} clipping;

in struct Varyings {
    vec3 dirVS;
} varyings;

layout(location = 0) out vec4 color;
layout(location = 1) out vec2 normal;
layout(location = 2) out float linearDepth;
layout(location = 3) out uvec2 info;

const uint undefinedIndex = 7U;
const uint clippingId = 0xfffffff0U;

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
    color = rgba;
    normal = clipping.planes[idx[i]].xy;
    linearDepth = -posVS.z;
    info = uvec2(objectId, 0);
}
