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
// const uint vertexObjectId = 0xffffffffU;

out struct {
    highp vec3 positionVS;
    highp vec2 screenPos;
} varyings;

flat out struct {
    mediump vec4 color;
    mediump float radius;
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
} varyingsFlat;

void main() {
    vec2 pos = vertexPositions;
    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;
    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);

    float linearSize = outline.linearSize;
    mediump float projectedSize = max(0., camera.viewClipMatrix[1][1] * linearSize * float(camera.viewSize.y) * 1.0 / gl_Position.w);
    gl_PointSize = clamp(projectedSize, 3., 25.);

    varyingsFlat.radius = max(1.0, gl_PointSize * 0.5);
    varyings.positionVS = posVS;
    // Convert position to window coordinates
    vec2 halfsize = camera.viewSize * 0.5;
    varyings.screenPos = halfsize + ((gl_Position.xy / gl_Position.w) * halfsize);

    varyingsFlat.color = vec4(outline.pointColor, 1);

    highp uint objectId = 0x7000000U | uint(gl_VertexID);

#if defined (ADRENO600)
    varyingsFlat.objectId_high = objectId >> 16u;
    varyingsFlat.objectId_low = objectId & 0xffffu;
#else
    varyingsFlat.objectId = objectId;
#endif
}