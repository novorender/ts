layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 clipWorldMatrix;
    mat4 worldViewMatrix;
    mat4 worldClipMatrix;
    mat4 viewWorldMatrix;
    mat4 viewClipMatrix;
    mat3 clipViewNormalMatrix;
    mat3 clipWorldNormalMatrix;
    mat3 worldViewNormalMatrix;
    mat3 worldClipNormalMatrix;
    mat3 viewWorldNormalMatrix;
    mat3 viewClipNormalMatrix;
} camera;

layout(std140) uniform Grid {
    vec3 origin;
    vec3 axisX;
    vec3 axisY;
    vec4 color;
    int size;
    float spacing;
} grid;

out vec4 gridColor;

void main() {
    int xi, yi;
    int s1 = grid.size + 1;
    if(gl_VertexID < s1 * 2) {
        xi = gl_VertexID / 2 % s1;
        yi = gl_VertexID % 2 == 0 ? grid.size : 0;
    } else {
        xi = gl_VertexID % 2 == 0 ? grid.size : 0;
        yi = gl_VertexID / 2 % s1;
    }
    float c = float(grid.size) / 2.0;
    float x = (float(xi) - c) * grid.spacing;
    float y = (float(yi) - c) * grid.spacing;
    vec4 posOS = vec4(grid.origin + grid.axisX * x + grid.axisY * y, 1);
    gl_Position = camera.worldClipMatrix * posOS;
    gridColor = grid.color;
}
