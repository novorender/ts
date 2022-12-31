layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Background {
    float envBlurNormalized;
    int mipCount;
} background;

uniform samplerCube textures_background;
uniform samplerCube textures_specular;

out struct Varyings {
    vec3 dir;
} varyings;

void main() {
    // Use degenerate triangle if ortho camera to use clear color instead
    bool isPerspective = camera.viewClipMatrix[3][3] == 0.0;
    vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 2.0 - 1.0;
    gl_Position = isPerspective ? vec4(pos, 1, 1) : vec4(0);
    vec3 dirVS = vec3(pos.x / camera.viewClipMatrix[0][0], pos.y / camera.viewClipMatrix[1][1], -1);
    varyings.dir = camera.viewWorldMatrixNormal * dirVS;
}
