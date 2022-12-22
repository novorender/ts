layout(std140) uniform Watermark {
    mat4 modelClipMatrix;
    vec4 color;
} watermark;

in struct {
    float elevation;
} varyings;

layout(location = 0) out vec4 color;

void main() {
    float a = clamp(varyings.elevation, 0.0, 1.0);
    color = vec4(watermark.color.rgb, a);
}