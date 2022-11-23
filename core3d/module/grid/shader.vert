layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Grid {
    mat4 objectClipMatrix;
    vec4 color;
    int size;
    float spacing;
} grid;

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
    vec4 posOS = vec4(x, 0, y, 1);
    gl_Position = grid.objectClipMatrix * posOS;
}
