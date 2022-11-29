const float maxDeviation = 1.;
const float maxIntensity = 255.;

const uint modeColor = 0U;
const uint modeNormal = 1U;
const uint modeDepth = 2U;
const uint modeObjectId = 3U;
const uint modeDeviation = 4U;
const uint modeIntensity = 5U;

layout(std140) uniform Tonemapping {
    float exposure;
    uint mode;
    float maxLinearDepth;
} tonemapping;

uniform sampler2D textures_color;
uniform sampler2D textures_depth;
uniform sampler2D textures_normal;
uniform usampler2D textures_info;

struct Varyings {
    vec2 uv;
};
out Varyings varyings;

void main() {
    varyings.uv = vec2(gl_VertexID % 2, gl_VertexID / 2);
    gl_Position = vec4(varyings.uv * 2.0 - 1.0, 0, 1);
}
