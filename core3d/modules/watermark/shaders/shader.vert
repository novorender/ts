layout(std140) uniform Watermark {
    WatermarkUniforms watermark;
};

out WatermarkVaryings varyings;

layout(location = 0) in vec3 vertexPosition;

void main() {
    vec4 p = watermark.modelClipMatrix * vec4(vertexPosition, 1.0);
    varyings.elevation = p.z;
    gl_Position = vec4(p.xy, 0.0, 1.0);
}
