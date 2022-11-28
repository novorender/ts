layout(std140) uniform Node {
    mat4 objectClipMatrix;
    vec4 debugColor;
} node;

const float size = 0.9;
const int ccwIndices[12] = int[12](0, 1, 2, 0, 2, 3, 0, 3, 1, 1, 3, 2);
const int cwIndices[12] = int[12](0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3);
const vec3 corners[8] = vec3[8](vec3(-1, -1, -1), vec3(-1, 1, 1), vec3(1, -1, 1), vec3(1, 1, -1), vec3(-1, -1, 1), vec3(-1, 1, -1), vec3(1, -1, -1), vec3(1, 1, 1));

out vec4 color;

void main() {
    vec3 pos = corners[gl_VertexID / 12];
    int idx = (gl_VertexID / 12) < 4 ? cwIndices[gl_VertexID % 12] : ccwIndices[gl_VertexID % 12];
    color = node.debugColor;
    if(idx > 0) {
        pos[idx - 1] *= size;
        color.rgb *= 0.75;
    }
    gl_Position = node.objectClipMatrix * vec4(pos, 1);

}
