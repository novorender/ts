layout(std140) uniform Camera {
    CameraUniforms camera;
};

// layout(std140) uniform ToonOutline {
//     ToonOutlineUniforms toonOutline;
// };

out highp vec2 uv;

void main() {
    uv = vec2(gl_VertexID % 2, gl_VertexID / 2);
    gl_Position = vec4(uv * 2.0f - 1.0f, 0, 1);
}
