const float maxDeviation = 1.;
const float maxIntensity = 255.;

const uint modeColor = 0U;
const uint modeNormal = 1U;
const uint modeDepth = 2U;
const uint modeObjectId = 3U;
const uint modeDeviation = 4U;
const uint modeIntensity = 5U;
const uint modeZbuffer = 6U;

layout(std140) uniform Tonemapping {
    float exposure;
    uint mode;
    float maxLinearDepth;
} tonemapping;

uniform sampler2D textures_color;
uniform sampler2D textures_normal;
uniform sampler2D textures_depth;
uniform usampler2D textures_info;
uniform sampler2D textures_zbuffer;

in struct {
    vec2 uv;
} varyings;

layout(location = 0) out vec4 fragColor;

uint hash(uint x) {
    x += (x << 10u);
    x ^= (x >> 6u);
    x += (x << 3u);
    x ^= (x >> 11u);
    x += (x << 15u);
    return x;
}
const float GAMMA = 2.2;
const float INV_GAMMA = 1.0 / GAMMA;

// linear to sRGB approximation
// see http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
vec3 linearTosRGB(vec3 color) {
    return pow(color, vec3(INV_GAMMA));
}

// sRGB to linear approximation
// see http://chilliant.blogspot.com/2012/08/srgb-approximations-for-hlsl.html
vec3 sRGBToLinear(vec3 srgbIn) {
    return vec3(pow(srgbIn.xyz, vec3(GAMMA)));
}

// ACES tone map (faster approximation)
// see: https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
vec3 toneMapACES_Narkowicz(vec3 color) {
    const float A = 2.51;
    const float B = 0.03;
    const float C = 2.43;
    const float D = 0.59;
    const float E = 0.14;
    return clamp((color * (A * color + B)) / (color * (C * color + D) + E), 0.0, 1.0);
}

// ACES filmic tone map approximation
// see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
vec3 RRTAndODTFit(vec3 color) {
    vec3 a = color * (color + 0.0245786) - 0.000090537;
    vec3 b = color * (0.983729 * color + 0.4329510) + 0.238081;
    return a / b;
}

void main() {
    vec4 color = vec4(1, 0, 0, 1);
    switch(tonemapping.mode) {
        case modeColor: {
            color = texture(textures_color, varyings.uv);
            color.rgb = RRTAndODTFit(color.rgb * tonemapping.exposure);
            color.rgb = linearTosRGB(color.rgb);// * color.a;
            break;
        }
        case modeNormal: {
            vec2 xy = texture(textures_normal, varyings.uv).xy;
            if(any(isnan(xy))) {
                color.rgb = vec3(0);
            } else {
                float z = sqrt(1. - dot(xy, xy));
                color.rgb = vec3(xy, z) * .5 + .5;
            }
            break;
        }
        case modeDepth: {
            float linearDepth = texture(textures_depth, varyings.uv).x;
            if(isinf(linearDepth)) {
                color.rgb = vec3(0, 0, 0.25);
            } else {
                float i = (linearDepth / tonemapping.maxLinearDepth);
                color.rgb = vec3(pow(i, 0.5));
            }
            break;
        }
        case modeObjectId: {
            uint objectId = texture(textures_info, varyings.uv).x;
            if(objectId == 0xffffffffU) {
                color.rgb = vec3(0);
            } else {
                // color.rgb = vec3(0,1,1);
                uint rgba = hash(~objectId);
                float r = float((rgba >> 16U) & 0xffU) / 255.;
                float g = float((rgba >> 8U) & 0xffU) / 255.;
                float b = float((rgba >> 0U) & 0xffU) / 255.;
                color.rgb = vec3(r, g, b);
            }
            break;
        }
        case modeDeviation: {
            float deviation = unpackHalf2x16(texture(textures_info, varyings.uv).y).x;
            color.rgb = deviation > 0. ? vec3(0, deviation / maxDeviation, 0) : vec3(-deviation / maxDeviation, 0, 0);
            break;
        }
        case modeIntensity: {
            float intensity = unpackHalf2x16(texture(textures_info, varyings.uv).y).y;
            color.rgb = vec3(intensity / maxIntensity);
            break;
        }
        case modeZbuffer: {
            float z = texture(textures_zbuffer, varyings.uv).x;
            color.rgb = vec3(z);
            break;
        }
    }
    fragColor = color;
}
