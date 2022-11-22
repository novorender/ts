uniform mat4 objProj;
uniform int size;
uniform float spacing;

void main() {
    float x, y;
    if(gl_VertexID < size * 2) {
        x = float(gl_VertexID / 2 % size);
        y = float((gl_VertexID % 2) == 0 ? size : -size);
    } else {
        x = float((gl_VertexID % 2) == 0 ? size : -size);
        y = float(gl_VertexID / 2 % size);
    }
    float o = float(size) * spacing / 2.0;
    vec4 posOS = vec4(x * spacing - o, y * spacing - o, 0, 1);
    gl_Position = objProj * posOS;
}
