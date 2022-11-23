layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewNormalMatrix;
    mat3 viewWorldNormalMatrix;
} camera;

layout(std140) uniform Grid {
    mat4 objectClipMatrix;
    vec4 color;
    int size;
    float spacing;
} grid;

out vec4 fragColor;

void main() {
    fragColor = grid.color;
}
