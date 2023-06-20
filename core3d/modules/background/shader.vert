layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Background {
    BackgroundUniforms background;
};

uniform BackgroundTextures textures;

out BackgroundVaryings varyings;

void main() {
    // output degenerate triangle if ortho camera to use clear color instead
    bool isPerspective = camera.viewClipMatrix[3][3] == 0.0;
    vec2 pos = vec2(gl_VertexID % 2, gl_VertexID / 2) * 2.0 - 1.0;
    gl_Position = isPerspective ? vec4(pos, 1, 1) : vec4(0);
    vec3 dirVS = vec3(pos.x / camera.viewClipMatrix[0][0], pos.y / camera.viewClipMatrix[1][1], -1);
    varyings.dir = camera.viewLocalMatrixNormal * dirVS;
}
