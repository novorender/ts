layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Grid {
    GridUniforms grid;
};

in GridVaryings varyings;

layout(location = 0) out vec4 fragColor;

float getGrid(vec2 r) {
    vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
    float line = min(grid.x, grid.y);
    return 1.0 - min(line, 1.0);
}

void main() {
    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    float d = 1.0 - min(distance(cameraPosLS, varyings.posLS) / grid.distance, 1.0);
    float g1 = getGrid(varyings.posOS / grid.size1);
    float g2 = getGrid(varyings.posOS / grid.size2);
    fragColor = vec4(g2 > 0.1 ? grid.color2 : grid.color1, mix(g2, g1, g1) * pow(d, 3.0));
    fragColor.a = mix(0.5 * fragColor.a, fragColor.a, g2);
    if(fragColor.a <= 0.0)
        discard;
}
