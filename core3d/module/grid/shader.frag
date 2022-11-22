// layout(std140) uniform Camera {
//     mat4 objClip;
// };

// layout(std140) uniform Grid {
//     vec3 origin;
//     vec3 axisX;
//     vec3 axisY;
//     vec4 color;
//     int size;
//     float spacing;
// };

in vec4 gridColor;
out vec4 fragColor;

void main() {
    fragColor = gridColor;
}
