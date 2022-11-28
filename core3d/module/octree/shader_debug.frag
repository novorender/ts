layout(std140) uniform Node {
    mat4 objectClipMatrix;
    vec4 debugColor;
} node;

in vec4 color;
out vec4 fragColor;

void main() {
    fragColor = color;
}
