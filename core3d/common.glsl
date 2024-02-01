// shared/global stuff
#define PASS_COLOR 0
#define PASS_PICK 1
#define PASS_PRE 2

#ifndef PASS
#define PASS PASS_COLOR // avoid red squigglies in editor
#endif

struct CameraUniforms {
    highp mat4 clipViewMatrix;
    highp mat4 viewClipMatrix;
    highp mat4 localViewMatrix;
    highp mat4 viewLocalMatrix;
    highp mat3 localViewMatrixNormal;
    highp mat3 viewLocalMatrixNormal;
    highp vec2 viewSize;
    highp float near; // near clipping plane distance
};
struct IBLTextures {
    mediump samplerCube specular;
    mediump samplerCube diffuse;
};

// background
struct BackgroundVaryings {
    mediump vec3 dir;
};
struct BackgroundUniforms {
    lowp float envBlurNormalized;
    lowp int mipCount;
};
struct BackgroundTextures {
    lowp samplerCube skybox;
    IBLTextures ibl;
};

// clipping
const lowp uint undefinedIndex = 7U;
const highp uint clippingId = 0xfffffff0U;
const lowp uint clippingModeIntersection = 0U;
const lowp uint clippingModeUnion = 1U;
struct ClippingVaryings {
    mediump vec3 dirVS;
};
struct ClippingUniforms {
    highp vec4 planes[6];
    lowp uint numPlanes;
    lowp uint mode; // 0 = intersection, 1 = union
};
struct ClippingColors {
    mediump vec4 colors[6];
};
bool clip(highp vec3 point, ClippingUniforms clipping) {
    float s = clipping.mode == clippingModeIntersection ? -1.f : 1.f;
    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;
    for(uint i = 0U; i < clipping.numPlanes; i++) {
        inside = inside && dot(vec4(point, 1), clipping.planes[i]) * s < 0.f;
    }
    return clipping.mode == clippingModeIntersection ? inside : !inside;
}

// outlines
struct OutlineUniforms {
    highp mat4 localPlaneMatrix;
    highp mat4 planeLocalMatrix;
    mediump vec3 lineColor;
    lowp int planeIndex;
    mediump vec3 pointColor;
    mediump float linearSize;
    mediump float minPixelSize;
    mediump float maxPixelSize;
    mediump float pointScale;
    highp uint pointObjectIdBase;
};

bool clipOutlines(highp vec3 point, ClippingUniforms clipping) {
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
    highp vec3 posVS;
    mediump vec3 normal;
    mediump vec3 color;
};
struct CubeUniforms {
    highp mat4 modelLocalMatrix;
};

// grid
struct GridVaryings {
    highp vec2 posOS;
    highp vec3 posLS;
};
struct GridUniforms {
    // below coords are in local space
    highp vec3 origin;
    mediump vec3 axisX;
    mediump vec3 axisY;
    highp float size1;
    highp float size2;
    mediump vec3 color1;
    mediump vec3 color2;
    highp float distance;
};

struct ToonOutlineUniforms {
    mediump vec3 color;
    uint outlineObjects;
};

// dynamic geometry
const vec3 ambientLight = vec3(0);
struct DynamicVaryings {
    mediump vec4 color0;
    highp vec2 texCoord0;
    highp vec2 texCoord1;
    highp vec3 positionVS;
    highp float linearDepth;
    mediump mat3 tbn; // in world space
    highp vec3 toCamera; // in world space (camera - position)
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
    mediump vec4 baseColorFactor;
    mediump vec3 emissiveFactor;
    mediump float roughnessFactor;
    mediump float metallicFactor;
    mediump float normalScale;
    mediump float occlusionStrength;
    mediump float alphaCutoff;
    lowp int baseColorUVSet;
    lowp int metallicRoughnessUVSet;
    lowp int normalUVSet;
    lowp int occlusionUVSet;
    lowp int emissiveUVSet;
    lowp uint radianceMipCount;
};
struct ObjectUniforms {
    highp mat4 worldLocalMatrix;
    highp uint baseObjectId;
};
struct DynamicTextures {
    mediump sampler2D lut_ggx;
    IBLTextures ibl;
    lowp sampler2D base_color;
    mediump sampler2D metallic_roughness;
    mediump sampler2D normal;
    mediump sampler2D emissive;
    mediump sampler2D occlusion;
};

// octree
#define MODE_TRIANGLES 0
#define MODE_POINTS 1
#define MODE_TERRAIN 2

#ifndef MODE
#define MODE MODE_TRIANGLES // avoid red squigglies in editor
#endif

#ifndef NUM_CLIPPING_PLANES
#define NUM_CLIPPING_PLANES 0 // avoid red squigglies in editor
#endif

const uint maxHighlights = 256U;
struct OctreeVaryings {
    highp vec3 positionLS; // world/local space
    mediump vec3 normalLS; // world/local space
    highp vec3 positionVS; // view space
    mediump vec3 normalVS; // view space
    highp vec3 toCamera; // world/local space
    highp vec2 texCoord0;
    highp vec2 screenPos;
    mediump float radius;
    mediump float deviation;
    mediump float elevation;
};
struct OctreeVaryingsFlat {
    lowp vec4 color;
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
    lowp uint highlight;
};
struct SceneUniforms {
    bool applyDefaultHighlight;
    lowp float iblMipCount;
    // point cloud
    mediump float pixelSize;
    mediump float maxPixelSize;
    mediump float metricSize;
    mediump float toleranceFactor;
    lowp int deviationIndex;
    mediump float deviationFactor;
    mediump vec2 deviationRange;
    mediump vec4 deviationUndefinedColor;
    bool useProjectedPosition;
    // terrain elevation
    highp vec2 elevationRange;
    lowp float pickOpacityThreshold;
};
struct NodeUniforms {
    highp mat4 modelLocalMatrix;
    mediump float tolerance;
    lowp vec4 debugColor;
    // min,max are in local space
    highp vec3 min;
    highp vec3 max;
};
const struct OctreeTextures {
    IBLTextures ibl;
    lowp sampler2D materials;
    mediump sampler2D highlights;
    mediump sampler2D gradients;
    mediump sampler2D lut_ggx;
    mediump sampler2DArray base_color;
    mediump sampler2DArray normal;
    mediump sampler2DArray orm; // occlusion, roughness and metalness
};
const struct NodeTextures {
    lowp sampler2D unlit_color;
};

// watermark
struct WatermarkVaryings {
    mediump float elevation;
};
struct WatermarkUniforms {
    highp mat4 modelClipMatrix;
    mediump vec4 color;
};

// tonemapping
const mediump float tonemapMaxDeviation = 1.f;
const lowp uint tonemapModeColor = 0U;
const lowp uint tonemapModeNormal = 1U;
const lowp uint tonemapModeDepth = 2U;
const lowp uint tonemapModeObjectId = 3U;
const lowp uint tonemapModeDeviation = 4U;
const lowp uint tonemapModeZbuffer = 5U;
struct TonemappingVaryings {
    highp vec2 uv;
};
struct TonemappingUniforms {
    mediump float exposure;
    lowp uint mode;
    highp float maxLinearDepth;
};
struct TonemappingTextures {
    mediump sampler2D color;
    highp usampler2D pick;
    highp sampler2D zbuffer;
};

// dither transparency
const mediump mat4 ditherThresholds = mat4(0.0f / 16.0f, 8.0f / 16.0f, 2.0f / 16.0f, 10.0f / 16.0f, 12.0f / 16.0f, 4.0f / 16.0f, 14.0f / 16.0f, 6.0f / 16.0f, 3.0f / 16.0f, 11.0f / 16.0f, 1.0f / 16.0f, 9.0f / 16.0f, 15.0f / 16.0f, 7.0f / 16.0f, 13.0f / 16.0f, 5.0f / 16.0f);
mediump float dither(highp vec2 xy) {
    lowp int x = int(xy.x) & 3;
    lowp int y = int(xy.y) & 3;
    return ditherThresholds[y][x];
}

// sRGB
const mediump float GAMMA = 2.2f;
const mediump float INV_GAMMA = 1.0f / GAMMA;
// linear to sRGB approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
mediump vec3 linearTosRGB(mediump vec3 color) {
    return pow(color, vec3(INV_GAMMA));
}
// sRGB to linear approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
mediump vec3 sRGBToLinear(mediump vec3 srgbIn) {
    return vec3(pow(srgbIn.xyz, vec3(GAMMA)));
}

mediump float toLinear(mediump float f) {
    if(f <= 0.0404482362771082f) {
        return f / 12.92f;
    }
    return pow(((f + 0.055f) / 1.055f), 2.4f);
}

// sRGB to linear approximation (http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html)
mediump vec3 sRGBToLinearComplex(mediump vec3 srgbIn) {
    return vec3(toLinear(srgbIn.r), toLinear(srgbIn.g), toLinear(srgbIn.b));
}

// gradients
const mediump float numGradients = 2.f;
const mediump float deviationV = 0.f / numGradients + .5f / numGradients;
const mediump float elevationV = 1.f / numGradients + .5f / numGradients;

mediump vec4 getGradientColor(mediump sampler2D gradientTexture, highp float position, mediump float v, highp vec2 range) {
    mediump float u = (range[0] >= range[1]) ? 0.f : (position - range[0]) / (range[1] - range[0]);
    return texture(gradientTexture, vec2(u, v));
}

// packing

// we use octrahedral packing of normals to map 3 components down to 2: https://jcgt.org/published/0003/02/01/
mediump vec2 signNotZero(mediump vec2 v) { // returns ±1
    return vec2((v.x >= 0.f) ? +1.f : -1.f, (v.y >= 0.f) ? +1.f : -1.f);
}

mediump vec2 float32x3_to_oct(mediump vec3 v) { // assume normalized input. Output is on [-1, 1] for each component.
    // project the sphere onto the octahedron, and then onto the xy plane
    mediump vec2 p = v.xy * (1.f / (abs(v.x) + abs(v.y) + abs(v.z)));
    // reflect the folds of the lower hemisphere over the diagonals
    return (v.z <= 0.f) ? ((1.f - abs(p.yx)) * signNotZero(p)) : p;
}

mediump vec3 oct_to_float32x3(mediump vec2 e) {
    mediump vec3 v = vec3(e.xy, 1.f - abs(e.x) - abs(e.y));
    if(v.z < 0.f)
        v.xy = (1.f - abs(v.yx)) * signNotZero(v.xy);
    return normalize(v);
}

highp uvec2 packNormalAndDeviation(mediump vec3 normal, mediump float deviation) {
    return uvec2(packHalf2x16(normal.xy), packHalf2x16(vec2(normal.z, deviation)));
}

highp uvec2 packNormal(mediump vec3 normal) {
    return packNormalAndDeviation(normal, 0.f);
}

mediump vec4 unpackNormalAndDeviation(highp uvec2 normalAndDeviation) {
    return vec4(unpackHalf2x16(normalAndDeviation[0]), unpackHalf2x16(normalAndDeviation[1]));
}

highp uint combineMediumP(highp uint high, highp uint low) {
    return (high << 16u) | (low & 0xffffu);
}
