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

out struct {
    vec2 posOS;
    vec3 posLS;
} varyings;

void main() {
    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    vec2 posOS = (vec2(gl_VertexID % 2, gl_VertexID / 2) * 2. - 1.) * grid.distance;
    posOS += vec2(dot(cameraPosLS - grid.origin, grid.axisX), dot(cameraPosLS - grid.origin, grid.axisY));
    vec3 posLS = grid.origin + grid.axisX * posOS.x + grid.axisY * posOS.y;
    varyings.posOS = posOS;
    varyings.posLS = posLS;
    gl_Position = camera.viewClipMatrix * camera.localViewMatrix * vec4(posLS, 1);
}
