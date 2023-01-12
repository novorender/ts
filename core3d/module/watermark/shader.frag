layout(std140) uniform Watermark {
    WatermarkUniforms watermark;
};

in WatermarkVaryings varyings;

layout(location = 0) out vec4 fragColor;

void main() {
    float a = clamp(varyings.elevation, 0.0, 1.0);
    fragColor = vec4(watermark.color.rgb, a);
}