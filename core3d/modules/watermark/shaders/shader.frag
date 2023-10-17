layout(std140) uniform Watermark {
    WatermarkUniforms watermark;
};

in WatermarkVaryings varyings;

layout(location = 0) out mediump vec4 fragColor;

void main() {
    float a = clamp(varyings.elevation, 0.0f, 1.0f);
    fragColor = vec4(watermark.color.rgb, a);
}