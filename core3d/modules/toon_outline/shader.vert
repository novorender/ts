layout(std140) uniform Camera {
    CameraUniforms camera;
};

// layout(std140) uniform ToonOutline {
//     ToonOutlineUniforms toonOutline;
// };

out vec2 uv;

void main() {
    uv = vec2(gl_VertexID % 2, gl_VertexID / 2);
    gl_Position = vec4(uv * 2.0 - 1.0, 0, 1);
}
