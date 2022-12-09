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
uniform sampler2D textures_depth;
uniform sampler2D textures_normal;
uniform usampler2D textures_info;
uniform sampler2D textures_zbuffer;

out struct {
    vec2 uv;
} varyings;

void main() {
    varyings.uv = vec2(gl_VertexID % 2, gl_VertexID / 2);
    gl_Position = vec4(varyings.uv * 2.0 - 1.0, 0, 1);
}
