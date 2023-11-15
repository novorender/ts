layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

layout(location = 0) in vec2 vertexPositions;
// layout(location = 1) in mediump vec4 vertexColor;
// layout(location = 2) in uint vertexObjectId;
const vec4 vertexColor = vec4(1, 1, 0, 1);
const uint vertexObjectId = 0xffffffffU;

out struct {
    highp vec3 positionVS;
    highp vec2 screenPos;
    mediump vec4 color;
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
    vec2 pos = vertexPositions;
    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;
    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);
    gl_PointSize = 10.f;

    varyings.positionVS = posVS;
    // Convert position to window coordinates
    vec2 halfsize = camera.viewSize * 0.5f;
    varyings.screenPos = halfsize + ((gl_Position.xy / gl_Position.w) * halfsize);

    varyings.color = vertexColor;
#if defined (ADRENO600)
    varyingsFlat.objectId_high = vertexObjectId >> 16u;
    varyingsFlat.objectId_low = vertexObjectId & 0xffffu;
#else
    varyingsFlat.objectId = vertexObjectId;
#endif
}