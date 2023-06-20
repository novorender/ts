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

out OctreeVaryings varyings;
flat out OctreeVaryingsFlat varyingsFlat;

layout(location = 0) in vec4 vertexPosition;
#if (PASS != PASS_PRE)
layout(location = 1) in vec3 vertexNormal;
layout(location = 2) in uint vertexMaterial;
layout(location = 3) in uint vertexObjectId;
layout(location = 4) in vec2 vertexTexCoord0;
layout(location = 5) in vec4 vertexColor0;
layout(location = 6) in vec4 vertexProjectedPos;
layout(location = 7) in vec4 vertexDeviations;
layout(location = 8) in uint vertexHighlight;
#else
const vec3 vertexNormal = vec3(0);
const uint vertexMaterial = 0U;
const uint vertexObjectId = 0U;
const vec2 vertexTexCoord0 = vec2(0);
const vec4 vertexColor0 = vec4(1);
const vec4 vertexProjectedPos = vec4(0);
const vec4 vertexDeviations = vec4(0);
const uint vertexHighlight = 0U;
#endif

void main() {
    vec4 vertPos = vertexPosition;
    if(scene.useProjectedPosition && vertexProjectedPos.w != 0.) {
        vertPos = vertexProjectedPos;
    }
    vec4 posLS = node.modelLocalMatrix * vertPos;
    vec4 posVS = camera.localViewMatrix * posLS;
    gl_Position = camera.viewClipMatrix * posVS;

    vec4 color = vertexMaterial == 0xffU ? vertexColor0 : texture(textures.materials, vec2((float(vertexMaterial) + .5) / 256., .5));
    float deviation = uintBitsToFloat(0x7f800000U); // +inf

#if (MODE == MODE_POINTS)

    deviation = vertexDeviations[scene.deviationIndex];
    if(scene.deviationFactor > 0.) {
        vec4 gradientColor = getGradientColor(textures.gradients, deviation, deviationV, scene.deviationRange);
        color = mix(vertexColor0, gradientColor, scene.deviationFactor);
    }

        // compute point size
    float linearSize = scene.metricSize + node.tolerance * scene.toleranceFactor;
    float projectedSize = max(0., camera.viewClipMatrix[1][1] * linearSize * float(camera.viewSize.y) * 0.5 / gl_Position.w);
    gl_PointSize = min(scene.maxPixelSize, max(1.0, scene.pixelSize + projectedSize));

        // Convert position to window coordinates
    vec2 halfsize = camera.viewSize * 0.5;
    varyings.screenPos = halfsize + ((gl_Position.xy / gl_Position.w) * halfsize);

        // Convert radius to window coordinates
    varyings.radius = max(1.0, gl_PointSize * 0.5);
#elif defined (HIGHLIGHT)
    if(vertexHighlight == 0xFFU) {
        gl_Position = vec4(0); // hide 0xff group by outputing degenerate triangles/lines
    }
#endif

    varyings.positionVS = posVS.xyz;
    varyings.normalVS = normalize(camera.localViewMatrixNormal * vertexNormal);
    varyings.texCoord0 = vertexTexCoord0;
    varyings.deviation = deviation;
    varyings.elevation = posLS.y;
    varyingsFlat.color = color;
    varyingsFlat.objectId = vertexObjectId;
    varyingsFlat.highlight = vertexHighlight;
}
