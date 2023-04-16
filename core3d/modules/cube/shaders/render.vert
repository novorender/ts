layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

out CubeVaryings varyings;

layout(location = 0) in vec4 vertexPosition;
layout(location = 1) in vec3 vertexNormal;
layout(location = 2) in vec3 vertexColor;

void main() {
    vec4 posVS = camera.localViewMatrix * cube.modelLocalMatrix * vertexPosition;
    gl_Position = camera.viewClipMatrix * posVS;
    varyings.posVS = posVS.xyz;
    varyings.normal = vertexNormal;
    varyings.color = vertexColor;
}
