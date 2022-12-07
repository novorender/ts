layout(std140) uniform Grid {
    mat4 worldClipMatrix;
    vec3 origin;
    vec3 axisX;
    vec3 axisY;
    vec3 cameraPosition; // in world space
    float size1;
    float size2;
    vec3 color;
    float distance;
} grid;

in struct {
    vec2 posOS;
    vec3 posWS;
} varyings;

layout(location = 0) out vec4 color;

float getGrid(vec2 r) {
    vec2 grid = abs(fract(r - 0.5) - 0.5) / fwidth(r);
    float line = min(grid.x, grid.y);
    return 1.0 - min(line, 1.0);
}

void main() {
    float d = 1.0 - min(distance(grid.cameraPosition, varyings.posWS) / grid.distance, 1.0);
    float g1 = getGrid(varyings.posOS / grid.size1);
    float g2 = getGrid(varyings.posOS / grid.size2);
    color = vec4(grid.color, mix(g2, g1, g1) * pow(d, 3.0));
    color.a = mix(0.5 * color.a, color.a, g2);
    if(color.a <= 0.0)
        discard;
}
