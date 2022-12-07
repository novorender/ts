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

out struct {
    vec2 posOS;
    vec3 posWS;
} varyings;

void main() {
    vec2 posOS = (vec2(gl_VertexID % 2, gl_VertexID / 2) * 2. - 1.) * grid.distance;
    posOS += vec2(dot(grid.cameraPosition - grid.origin, grid.axisX), dot(grid.cameraPosition - grid.origin, grid.axisY));
    vec3 posWS = grid.origin + grid.axisX * posOS.x + grid.axisY * posOS.y;
    varyings.posOS = posOS;
    varyings.posWS = posWS;
    gl_Position = grid.worldClipMatrix * vec4(posWS, 1);
}
