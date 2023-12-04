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
    mediump float radius;
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

bool clipZ(inout vec4 v0, inout vec4 v1) {
    float z0 = v0.z;
    float z1 = v1.z;
    if(z0 <= 0. && z1 <= 0.) {
        return false;
    } else if(z0 < 0. && z1 > 0.) {
        float t = z1 / (z1 - z0);
        v0 = mix(v1, v0, t);
        v0.z = 0.;
    } else if(z1 < 0. && z0 > 0.) {
        float t = z0 / (z0 - z1);
        v1 = mix(v0, v1, t);
        v1.z = 0.;
        // v1 = v0;
    }
    return true;
}

void main() {
    // vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    // get plane space coordinates for line segment.
    vec2 v0PS = vertexPositions.xy;
    vec2 v1PS = vertexPositions.zw;

    // compute view space coordinates for line segment.
    vec4 v0VS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(v0PS, 0, 1));
    vec4 v1VS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(v1PS, 0, 1));

    // compute clip space coordinates for line segment.
    vec4 v0CS = (camera.viewClipMatrix * v0VS);
    vec4 v1CS = (camera.viewClipMatrix * v1VS);

    // clip line against front clipping plane (Z=0)
    if(!clipZ(v0CS, v1CS)) {
        gl_Position = vec4(0); // line segment is behind front clipping plane, i.e. invisible, and should be culled/degenerate.
        return;
    }

    // compute pixel coordinates.
    vec2 p0 = v0CS.xy / v0CS.w * camera.viewSize * 0.5;
    vec2 p1 = v1CS.xy / v1CS.w * camera.viewSize * 0.5;

    mediump float projectedSize0 = max(0., camera.viewClipMatrix[1][1] * outline.linearSize * float(camera.viewSize.y) / v0CS.w);
    mediump float projectedSize1 = max(0., camera.viewClipMatrix[1][1] * outline.linearSize * float(camera.viewSize.y) / v1CS.w);

    mediump float pixelSize0 = clamp(projectedSize0, outline.minPixelSize, outline.maxPixelSize);
    mediump float pixelSize1 = clamp(projectedSize1, outline.minPixelSize, outline.maxPixelSize);

    vec2 t = normalize(p1 - p0);
    vec2 n = vec2(-t.y, t.x);
    float len = distance(p0, p1);
    vec2 pos;
    vec2 uv;
    mediump float r;
    switch(gl_VertexID % 4) {
        case 0:
            r = pixelSize0 * .5;
            pos = p0 + (-t + n) * r;
            uv = vec2(-r, +r);
            break;
        case 1:
            r = pixelSize0 * .5;
            pos = p0 + (-t - n) * r;
            uv = vec2(-r, -r);
            break;
        case 2:
            r = pixelSize1 * .5;
            pos = p1 + (t + n) * r;
            uv = vec2(len + r, +r);
            break;
        case 3:
            r = pixelSize1 * .5;
            pos = p1 + (t - n) * r;
            uv = vec2(len + r, -r);
            break;
    }
    pos /= camera.viewSize * 0.5; // scale back down to NDC

    // vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    // vec3 posVS = (camera.localViewMatrix * outline.planeLocalMatrix * vec4(pos, 0, 1)).xyz;
    // vec2 pos = gl_VertexID % 2 == 0 ? vertexPositions.xy : vertexPositions.zw;
    vec3 posVS = gl_VertexID % 2 == 0 ? v0CS.xyz : v0CS.xyz;
    varyings.positionVS = posVS;
    varyings.uv = uv;
    varyings.radius = r;
    varyingsFlat.color = vertexColor * 4.; // allow some over-exposure from 8 bit colors
    varyingsFlat.len = len;

#if defined (ADRENO600)
    varyingsFlat.objectId_high = vertexObjectId >> 16u;
    varyingsFlat.objectId_low = vertexObjectId & 0xffffu;
#else
    varyingsFlat.objectId = vertexObjectId;
#endif
    // gl_Position = camera.viewClipMatrix * vec4(posVS, 1);
    gl_Position = vec4(pos, 0, 1);
}
