layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

layout(location = 0) in vec4 vertexPositions;
layout(location = 1) in mediump vec4 vertexColor;
layout(location = 2) in uint vertexObjectId;

out struct {
    highp vec3 positionVS;
    mediump vec2 uv;
} varyings;

flat out struct {
    mediump vec4 color;
    mediump float len;
#if defined (ADRENO600)
    mediump uint objectId_low;
    mediump uint objectId_high;
#else
    highp uint objectId;
#endif
} varyingsFlat;

void main() {
    // vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    vec2 p0 = vertexPositions.xy;
    vec2 p1 = vertexPositions.zw;
    float linearSize = outline.linearSize * .5;
    vec2 t = normalize(p1 - p0) * linearSize;
    vec2 n = vec2(-t.y, t.x);
    float len = distance(p0, p1) / linearSize;
    vec2 pos;
    vec2 uv;
    switch(gl_VertexID % 4) {
        case 0:
            pos = p0 - t + n;
            uv = vec2(-1, +1);
            break;
        case 1:
            pos = p0 - t - n;
            uv = vec2(-1, -1);
            break;
        case 2:
            pos = p1 + t + n;
            uv = vec2(len + 1., +1);
            break;
        case 3:
            pos = p1 + t - n;
            uv = vec2(len + 1., -1);
            break;
    }
    // vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;
    varyings.positionVS = posVS;
    varyings.uv = uv;
    varyingsFlat.color = vertexColor * 4.; // allow some over-exposure from 8 bit colors
    varyingsFlat.len = len;

#if defined (ADRENO600)
    varyingsFlat.objectId_high = vertexObjectId >> 16u;
    varyingsFlat.objectId_low = vertexObjectId & 0xffffu;
#else
    varyingsFlat.objectId = vertexObjectId;
#endif
    gl_Position = camera.viewClipMatrix * vec4(posVS, 1);
}
