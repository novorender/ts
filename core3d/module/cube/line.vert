layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

layout(location = 0) in vec2 vertexPosition;

void main() {
    gl_Position = camera.viewClipMatrix * vec4(vertexPosition.xy, -cube.clipDepth, 1);
}
