layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

struct Varyings {
    vec3 positionVS;
    float opacity;
};
in Varyings varyings;

layout(location = 0) out vec4 fragColor;

void main() {
    if(clipOutlines(varyings.positionVS, clipping))
        discard;
    fragColor = vec4(outline.lineColor, varyings.opacity);
}
