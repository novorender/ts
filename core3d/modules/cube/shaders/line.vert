layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

// layout(location = 0) in vec2 vertexPosition;
layout(location = 0) in vec4 vertexPositions;
layout(location = 1) in float vertexOpacity;

out float opacity;

void main() {
    // gl_Position = camera.viewClipMatrix * vec4(vertexPosition.xy, -camera.near, 1);
    vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    gl_Position = camera.viewClipMatrix * vec4(pos, -camera.near, 1);
    opacity = vertexOpacity;
}
