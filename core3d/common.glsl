// shared/global stuff
#define PASS_COLOR 0
#define PASS_PICK 1
#define PASS_PRE 2

#ifndef PASS
#define PASS PASS_COLOR // avoid red squigglies in editor
#endif

struct CameraUniforms {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 localViewMatrixNormal;
    mat3 viewLocalMatrixNormal;
    vec2 viewSize;
    float near; // near clipping plane distance
};
struct IBLTextures {
    samplerCube specular;
    samplerCube diffuse;
};

// background
struct BackgroundVaryings {
    vec3 dir;
};
struct BackgroundUniforms {
    float envBlurNormalized;
    int mipCount;
};
struct BackgroundTextures {
    samplerCube skybox;
    IBLTextures ibl;
};

// clipping
const uint undefinedIndex = 7U;
const uint clippingId = 0xfffffff0U;
const uint clippingModeIntersection = 0U;
const uint clippingModeUnion = 1U;
struct ClippingVaryings {
    vec3 dirVS;
};
struct ClippingUniforms {
    vec4 planes[6];
    uint numPlanes;
    uint mode; // 0 = intersection, 1 = union
};
struct ClippingColors {
    vec4 colors[6];
};
bool clip(vec3 point, ClippingUniforms clipping) {
    float s = clipping.mode == clippingModeIntersection ? -1.f : 1.f;
    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;
    for(uint i = 0U; i < clipping.numPlanes; i++) {
        inside = inside && dot(vec4(point, 1), clipping.planes[i]) * s < 0.f;
    }
    return clipping.mode == clippingModeIntersection ? inside : !inside;
}

// outlines
struct OutlineUniforms {
    mat4 localPlaneMatrix;
    mat4 planeLocalMatrix;
    vec3 color;
    int planeIndex;
};

bool clipOutlines(vec3 point, ClippingUniforms clipping) {
    float s = clipping.mode == clippingModeIntersection ? -1.f : 1.f;
    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;
    for(uint i = 0U; i < clipping.numPlanes; i++) {
        inside = inside && dot(vec4(point, 1), clipping.planes[i]) * s < 0.f;
    }
    return !inside;
}

// cube
const uint cubeId = 0xfffffff8U;
struct CubeVaryings {
    vec3 posVS;
    vec3 normal;
    vec3 color;
};
struct CubeUniforms {
    mat4 modelLocalMatrix;
};

// grid
struct GridVaryings {
    vec2 posOS;
    vec3 posLS;
};
struct GridUniforms {
    // below coords are in local space
    vec3 origin;
    vec3 axisX;
    vec3 axisY;
    float size1;
    float size2;
    vec3 color1;
    vec3 color2;
    float distance;
};

struct ToonOutlineUniforms {
    vec3 color;
};

// dynamic geometry
const vec3 ambientLight = vec3(0);
struct DynamicVaryings {
    vec4 color0;
    vec2 texCoord0;
    vec2 texCoord1;
    vec3 positionVS;
    float linearDepth;
    mat3 tbn; // in world space
    vec3 toCamera; // in world space (camera - position)
};
struct DynamicVaryingsFlat {
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
};
struct MaterialUniforms {
    vec4 baseColorFactor;
    vec3 emissiveFactor;
    float roughnessFactor;
    float metallicFactor;
    float normalScale;
    float occlusionStrength;
    float alphaCutoff;
    int baseColorUVSet;
    int metallicRoughnessUVSet;
    int normalUVSet;
    int occlusionUVSet;
    int emissiveUVSet;
    uint radianceMipCount;
};
struct ObjectUniforms {
    mat4 worldLocalMatrix;
    uint baseObjectId;
};
struct DynamicTextures {
    sampler2D lut_ggx;
    IBLTextures ibl;
    sampler2D base_color;
    sampler2D metallic_roughness;
    sampler2D normal;
    sampler2D emissive;
    sampler2D occlusion;
};

// octree
#define MODE_TRIANGLES 0
#define MODE_POINTS 1
#define MODE_TERRAIN 2

#ifndef MODE
#define MODE MODE_TRIANGLES // avoid red squigglies in editor
#endif

const uint maxHighlights = 256U;
struct OctreeVaryings {
    vec3 positionVS; // view space
    vec3 normalVS; // view space
    vec2 texCoord0;
    vec2 screenPos;
    float radius;
    float deviation;
    float elevation;
};
struct OctreeVaryingsFlat {
    vec4 color;
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
    uint highlight;
};
struct SceneUniforms {
    bool applyDefaultHighlight;
    float iblMipCount;
    // point cloud
    float pixelSize;
    float maxPixelSize;
    float metricSize;
    float toleranceFactor;
    int deviationIndex;
    float deviationFactor;
    vec2 deviationRange;
    vec4 deviationUndefinedColor;
    bool useProjectedPosition;
    // terrain elevation
    vec2 elevationRange;
    float pickOpacityThreshold;
};
struct NodeUniforms {
    mat4 modelLocalMatrix;
    float tolerance;
    vec4 debugColor;
    // min,max are in local space
    vec3 min;
    vec3 max;
};
const struct OctreeTextures {
    sampler2D base_color;
    IBLTextures ibl;
    sampler2D materials;
    sampler2D highlights;
    sampler2D gradients;
};

// watermark
struct WatermarkVaryings {
    float elevation;
};
struct WatermarkUniforms {
    mat4 modelClipMatrix;
    vec4 color;
};

// tonemapping
const float tonemapMaxDeviation = 1.f;
const uint tonemapModeColor = 0U;
const uint tonemapModeNormal = 1U;
const uint tonemapModeDepth = 2U;
const uint tonemapModeObjectId = 3U;
const uint tonemapModeDeviation = 4U;
const uint tonemapModeZbuffer = 5U;
struct TonemappingVaryings {
    vec2 uv;
};
struct TonemappingUniforms {
    float exposure;
    uint mode;
    float maxLinearDepth;
};
struct TonemappingTextures {
    sampler2D color;
    usampler2D pick;
    sampler2D zbuffer;
};

// dither transparency
const mat4 ditherThresholds = mat4(0.0f / 16.0f, 8.0f / 16.0f, 2.0f / 16.0f, 10.0f / 16.0f, 12.0f / 16.0f, 4.0f / 16.0f, 14.0f / 16.0f, 6.0f / 16.0f, 3.0f / 16.0f, 11.0f / 16.0f, 1.0f / 16.0f, 9.0f / 16.0f, 15.0f / 16.0f, 7.0f / 16.0f, 13.0f / 16.0f, 5.0f / 16.0f);
float dither(vec2 xy) {
    int x = int(xy.x) & 3;
    int y = int(xy.y) & 3;
    return ditherThresholds[y][x];
}

// sRGB
const float GAMMA = 2.2f;
const float INV_GAMMA = 1.0f / GAMMA;
// linear to sRGB approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
vec3 linearTosRGB(vec3 color) {
    return pow(color, vec3(INV_GAMMA));
}
// sRGB to linear approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
vec3 sRGBToLinear(vec3 srgbIn) {
    return vec3(pow(srgbIn.xyz, vec3(GAMMA)));
}

// gradients
const float numGradients = 2.f;
const float deviationV = 0.f / numGradients + .5f / numGradients;
const float elevationV = 1.f / numGradients + .5f / numGradients;

vec4 getGradientColor(sampler2D gradientTexture, float position, float v, vec2 range) {
    float u = (range[0] >= range[1]) ? 0.f : (position - range[0]) / (range[1] - range[0]);
    return texture(gradientTexture, vec2(u, v));
}

// packing

// we use octrahedral packing of normals to map 3 components down to 2: https://jcgt.org/published/0003/02/01/
vec2 signNotZero(vec2 v) { // returns ±1
    return vec2((v.x >= 0.f) ? +1.f : -1.f, (v.y >= 0.f) ? +1.f : -1.f);
}

vec2 float32x3_to_oct(vec3 v) { // assume normalized input. Output is on [-1, 1] for each component.
    // project the sphere onto the octahedron, and then onto the xy plane
    vec2 p = v.xy * (1.f / (abs(v.x) + abs(v.y) + abs(v.z)));
    // reflect the folds of the lower hemisphere over the diagonals
    return (v.z <= 0.f) ? ((1.f - abs(p.yx)) * signNotZero(p)) : p;
}

vec3 oct_to_float32x3(vec2 e) {
    vec3 v = vec3(e.xy, 1.f - abs(e.x) - abs(e.y));
    if(v.z < 0.f)
        v.xy = (1.f - abs(v.yx)) * signNotZero(v.xy);
    return normalize(v);
}

uvec2 packNormalAndDeviation(vec3 normal, float deviation) {
    return uvec2(packHalf2x16(normal.xy), packHalf2x16(vec2(normal.z, deviation)));
}

uvec2 packNormal(vec3 normal) {
    return packNormalAndDeviation(normal, 0.f);
}

vec4 unpackNormalAndDeviation(uvec2 normalAndDeviation) {
    return vec4(unpackHalf2x16(normalAndDeviation[0]), unpackHalf2x16(normalAndDeviation[1]));
}

highp uint combineMediumP(highp uint high, highp uint low) {
    return (high << 16u) | (low & 0xffffu);
}
