layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 localViewMatrixNormal;
    mat3 viewLocalMatrixNormal;
    vec2 viewSize;
} camera;

layout(std140) uniform Grid {
    // below coords are in local space
    vec3 origin;
    vec3 axisX;
    vec3 axisY;
    float size1;
    float size2;
    vec3 color;
    float distance;
} grid;

in struct {
    vec2 posOS;
    vec3 posLS;
} varyings;

layout(location = 0) out vec4 color;

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
    color = vec4(grid.color, mix(g2, g1, g1) * pow(d, 3.0));
    color.a = mix(0.5 * color.a, color.a, g2);
    if(color.a <= 0.0)
        discard;
}
