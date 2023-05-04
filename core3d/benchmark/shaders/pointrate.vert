void main() {
    vec2 pos = vec2(gl_VertexID % 1024, gl_VertexID / 1024) / 512.0 - 1.0;
    gl_Position = vec4(pos, 0, 1);
    gl_PointSize = 1.;
}