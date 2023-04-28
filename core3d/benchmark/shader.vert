uniform float depth;

void main() {
    vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 2.0 - 1.0;
    float z = 1. - float(gl_InstanceID) * depth;
    gl_Position = vec4(pos, z, 1);
}