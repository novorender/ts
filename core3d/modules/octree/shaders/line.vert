layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

layout(std140) uniform Node {
    NodeUniforms node;
};

layout(location = 0) in vec4 vertexPositions;
layout(location = 1) in float vertexOpacity;
layout(location = 2) in uint vertexObjectId;

out struct {
    vec3 positionVS;
    float opacity;
} varyings;

flat out struct {
    uint objectId;
} varyingsFlat;

void main() {
    vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;
    varyings.positionVS = posVS;
    varyings.opacity = vertexOpacity;
    varyingsFlat.objectId = vertexObjectId;
    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);
}
