layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

layout(std140) uniform Node {
    NodeUniforms node;
};

uniform OctreeTextures textures;
uniform uint meshMode;

out OctreeVaryings varyings;
#ifndef IOS_WORKAROUND
flat out OctreeVaryingsFlat varyingsFlat;
#endif

layout(location = 0) in vec4 vertexPosition;
#if !defined(PREPASS)
layout(location = 1) in vec3 vertexNormal;
layout(location = 2) in uint vertexMaterial;
layout(location = 3) in uint vertexObjectId;
layout(location = 4) in vec2 vertexTexCoord0;
layout(location = 5) in vec4 vertexColor0;
layout(location = 6) in float vertexDeviation;
layout(location = 7) in uint vertexHighlight;
#else
const vec3 vertexNormal = vec3(0);
const uint vertexMaterial = 0U;
const uint vertexObjectId = 0U;
const vec2 vertexTexCoord0 = vec2(0);
const vec4 vertexColor0 = vec4(1);
const float vertexDeviation = 0.;
const uint vertexHighlight = 0U;
#endif

void main() {
    vec4 posLS = node.modelLocalMatrix * vertexPosition;
    vec4 posVS = camera.localViewMatrix * posLS;
    gl_Position = camera.viewClipMatrix * posVS;
    vec4 color = vertexMaterial == 0xffU ? vertexColor0 : texture(textures.materials, vec2((float(vertexMaterial) + .5) / 256., .5));

    if(meshMode == meshModePoints) {
        if(scene.deviationFactor > 0.) {
            vec4 gradientColor = getGradientColor(textures.gradients, vertexDeviation, deviationV, scene.deviationRange);
            color = mix(vertexColor0, gradientColor, scene.deviationFactor);
        }

        // compute point size
        float linearSize = scene.metricSize + node.tolerance * scene.toleranceFactor;
        float projectedSize = camera.viewClipMatrix[1][1] * linearSize * float(camera.viewSize.y) * 0.5 / gl_Position.w;
        gl_PointSize = min(scene.maxPixelSize, max(1.0, scene.pixelSize + projectedSize));

        // Convert position to window coordinates
        vec2 halfsize = camera.viewSize * 0.5;
        varyings.screenPos = halfsize + ((gl_Position.xy / gl_Position.w) * halfsize);

        // Convert radius to window coordinates
        varyings.radius = max(1.0, gl_PointSize * 0.5);
        varyings.deviation = vertexDeviation;
    }

    varyings.positionVS = posVS.xyz;
    varyings.normalWS = vertexNormal;
    varyings.normalVS = camera.localViewMatrixNormal * vertexNormal;
    varyings.texCoord0 = vertexTexCoord0;
    varyings.elevation = posLS.y;
#if defined(IOS_WORKAROUND)
    varyings.color = color;
    varyings.objectId = vec2(vertexObjectId & 0xffffU, vertexObjectId >> 16U) + 0.5;
    varyings.highlight = float(vertexHighlight);
#else
    varyingsFlat.color = color;
    varyingsFlat.objectId = vertexObjectId;
    varyingsFlat.highlight = vertexHighlight;
#endif
}
