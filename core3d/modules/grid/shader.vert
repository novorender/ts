layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Grid {
    GridUniforms grid;
};

out GridVaryings varyings;

void main() {
    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    vec2 posOS = (vec2(gl_VertexID % 2, gl_VertexID / 2) * 2. - 1.) * grid.distance;
    posOS += vec2(dot(cameraPosLS - grid.origin, grid.axisX), dot(cameraPosLS - grid.origin, grid.axisY));
    vec3 posLS = grid.origin + grid.axisX * posOS.x + grid.axisY * posOS.y;
    varyings.posOS = posOS;
    varyings.posLS = posLS;
    gl_Position = camera.viewClipMatrix * camera.localViewMatrix * vec4(posLS, 1);
}
