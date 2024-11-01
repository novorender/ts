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
layout(location = 1) in uint hidden;

struct Varyings {
    highp vec3 positionVS;
    highp vec2 screenPos;
};
out Varyings varyings;

struct VaryingsFlat {
    mediump vec4 color;
    mediump float radius;
    mediump uint hidden;
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
};
flat out VaryingsFlat varyingsFlat;

void main() {
    varyingsFlat.hidden = hidden;
    vec2 pos = vertexPositions;
    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;
    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);

    mediump float projectedSize = max(0.f, camera.viewClipMatrix[1][1] * outline.linearSize * float(camera.viewSize.y) / gl_Position.w);
    gl_PointSize = projectedSize < outline.minPixelSize ? 0.f : clamp(projectedSize, outline.minPixelSize, outline.maxPixelSize) * outline.pointScale;

    varyingsFlat.radius = max(1.0f, gl_PointSize * 0.5f);
    varyings.positionVS = posVS;
    // Convert position to window coordinates
    vec2 halfsize = camera.viewSize * 0.5f;
    varyings.screenPos = halfsize + ((gl_Position.xy / gl_Position.w) * halfsize);

    varyingsFlat.color = vec4(outline.pointColor, 1);

    highp uint objectId = outline.pointObjectIdBase | uint(gl_VertexID);

#if defined (ADRENO600)
    varyingsFlat.objectId_high = objectId >> 16u;
    varyingsFlat.objectId_low = objectId & 0xffffu;
#else
    varyingsFlat.objectId = objectId;
#endif
}