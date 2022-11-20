uniform mat4 proj;
layout(location = 0) in vec4 position;
layout(location = 1) in vec4 vertexColor;
out vec4 color;

void main() {
    gl_Position = proj * position;
    color = vertexColor;
}
