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
layout(location = 1) in vec4 color;
layout(location = 2) in uint vertexObjectId;

out struct {
    vec3 positionVS;
    vec4 color;
} varyings;

#if defined (ADRENO600)
flat out struct {
    mediump uint objectId_low;
    mediump uint objectId_high;
} varyingsFlat;
#else
flat out struct {
    highp uint objectId;
} varyingsFlat;
#endif

void main() {
    vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;
    varyings.positionVS = posVS;
    varyings.color = color;
#if defined (ADRENO600)
    varyingsFlat.objectId_high = vertexObjectId >> 16u;
    varyingsFlat.objectId_low = vertexObjectId & 0xffffu;
#else
    varyingsFlat.objectId = vertexObjectId;
#endif
    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);
}
