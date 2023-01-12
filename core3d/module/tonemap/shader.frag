layout(std140) uniform Tonemapping {
    TonemappingUniforms tonemapping;
};

uniform TonemappingTextures textures;

in TonemappingVaryings varyings;

layout(location = 0) out vec4 fragColor;

uint hash(uint x) {
    x += (x << 10u);
    x ^= (x >> 6u);
    x += (x << 3u);
    x ^= (x >> 11u);
    x += (x << 15u);
    return x;
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
        case tonemapModeColor: {
            color = texture(textures.color, varyings.uv);
            color.rgb = RRTAndODTFit(color.rgb * tonemapping.exposure);
            color.rgb = linearTosRGB(color.rgb);// * color.a;
            break;
        }
        case tonemapModeNormal: {
            vec2 xy = texture(textures.normal, varyings.uv).xy;
            if(any(isnan(xy))) {
                color.rgb = vec3(0);
            } else {
                float z = sqrt(1. - dot(xy, xy));
                color.rgb = vec3(xy, z) * .5 + .5;
            }
            break;
        }
        case tonemapModeDepth: {
            float linearDepth = texture(textures.depth, varyings.uv).x;
            if(isinf(linearDepth)) {
                color.rgb = vec3(0, 0, 0.25);
            } else {
                float i = (linearDepth / tonemapping.maxLinearDepth);
                color.rgb = vec3(pow(i, 0.5));
            }
            break;
        }
        case tonemapModeObjectId: {
            uint objectId = texture(textures.info, varyings.uv).x;
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
        case tonemapModeDeviation: {
            float deviation = unpackHalf2x16(texture(textures.info, varyings.uv).y).x;
            color.rgb = deviation > 0. ? vec3(0, deviation / tonemapMaxDeviation, 0) : vec3(-deviation / tonemapMaxDeviation, 0, 0);
            break;
        }
        case tonemapModeZbuffer: {
            float z = texture(textures.zbuffer, varyings.uv).x;
            color.rgb = vec3(z);
            break;
        }
    }
    fragColor = color;
}
