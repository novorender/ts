layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

layout(location = 0) out vec4 fragColor;

void main() {
    fragColor = vec4(10, 10, 10, 1);
}
