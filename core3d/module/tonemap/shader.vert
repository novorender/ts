layout(std140) uniform Tonemapping {
    TonemappingUniforms tonemapping;
};

uniform TonemappingTextures textures;

out TonemappingVaryings varyings;

void main() {
    varyings.uv = vec2(gl_VertexID % 2, gl_VertexID / 2);
    gl_Position = vec4(varyings.uv * 2.0 - 1.0, 0, 1);
}
