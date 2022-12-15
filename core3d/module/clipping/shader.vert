layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Clipping {
    vec4 planes[6];
    vec4 colors[6];
    uint numPlanes;
    uint mode;
} clipping;

out struct Varyings {
    vec3 dir;
} varyings;

void main() {
    vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 2.0 - 1.0;
    vec3 dirVS = vec3(pos.x / camera.viewClipMatrix[0][0], pos.y / camera.viewClipMatrix[1][1], -1);
    varyings.dir = dirVS;
    gl_Position = vec4(pos, 0.9, 1);
}
