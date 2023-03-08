layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

in struct {
    vec3 positionVS;
    float opacity;
} varyings;

layout(location = 0) out vec4 fragColor;

void main() {
    if(clip(varyings.positionVS, clipping))
        discard;
    fragColor = vec4(cube.nearOutlineColor, varyings.opacity);
}
