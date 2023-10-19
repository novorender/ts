layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Grid {
    GridUniforms grid;
};

in GridVaryings varyings;

layout(location = 0) out mediump vec4 fragColor;

float getGrid(vec2 r) {
    vec2 grid = abs(fract(r - 0.5f) - 0.5f) / fwidth(r);
    float line = min(grid.x, grid.y);
    return 1.0f - min(line, 1.0f);
}

void main() {
    highp vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    highp float d = 1.0f - min(distance(cameraPosLS, varyings.posLS) / grid.distance, 1.0f);
    mediump float g1 = getGrid(varyings.posOS / grid.size1);
    mediump float g2 = getGrid(varyings.posOS / grid.size2);
    fragColor = vec4(g2 > 0.001f ? grid.color2 : grid.color1, max(g2, g1) * pow(d, 3.0f));
    fragColor.a = mix(0.5f * fragColor.a, fragColor.a, g2) * 1.5f;
    if(fragColor.a <= 0.0f)
        discard;
}
