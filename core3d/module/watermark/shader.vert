layout(std140) uniform Watermark {
    mat4 modelClipMatrix;
    vec4 color;
} watermark;

out struct {
    float elevation;
} varyings;

layout(location = 0) in vec3 position;

void main() {
    vec4 p = watermark.modelClipMatrix * vec4(position, 1.0);
    varyings.elevation = p.z;
    gl_Position = vec4(p.xy, 0.0, 1.0);
}
