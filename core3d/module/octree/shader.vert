layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 localViewMatrixNormal;
    mat3 viewLocalMatrixNormal;
    vec2 viewSize;
} camera;

layout(std140) uniform Scene {
    bool applyDefaultHighlight;
    float iblMipCount;
    // point cloud
    float pixelSize;
    float maxPixelSize;
    float metricSize;
    float toleranceFactor;
    uint deviationMode;
    vec2 deviationRange;
    // terrain elevation
    vec2 elevationRange;
} scene;

layout(std140) uniform Node {
    mat4 modelLocalMatrix;
    float tolerance;
    vec4 debugColor;
    // min,max are in local space
    vec3 min;
    vec3 max;
} node;

const uint MeshMode_Triangles = 0U;
const uint MeshMode_Points = 1U;
layout(std140) uniform Mesh {
    uint mode; // MeshMode
} mesh;

const uint maxHighlights = 256U;
uniform sampler2D texture_base_color;
uniform samplerCube texture_ibl_diffuse;
uniform samplerCube texture_ibl_specular;
uniform sampler2D texture_materials;
uniform sampler2D texture_highlights;
uniform sampler2D texture_gradients;

out struct {
    vec3 positionVS; // view space
    vec3 normalWS; // world space
    vec3 normalVS; // view space
    vec2 texCoord0;
    float linearDepth;
    vec2 screenPos;
    float radius;
    float deviation;
    float intensity;
#ifdef IOS_WORKAROUND
    vec4 color;
    vec2 objectId; // older (<A15) IOS and IPADs crash if we use flat/uint here, so we use two floats instead
    float highlight;
#endif
} varyings;

#ifndef IOS_WORKAROUND
flat out struct {
    vec4 color;
    uint objectId;
    uint highlight;
} varyingsFlat;
#endif

layout(location = 0) in vec4 position;
#ifndef POS_ONLY
layout(location = 1) in vec3 normal;
layout(location = 2) in uint material;
layout(location = 3) in uint objectId;
layout(location = 4) in vec2 texCoord0;
layout(location = 5) in vec4 color0;
layout(location = 6) in float deviation;
layout(location = 7) in uint highlight;
#else
const vec3 normal = vec3(0);
const uint material = 0U;
const uint objectId = 0U;
const vec2 texCoord0 = vec2(0);
const vec4 color0 = vec4(0);
const float deviation = 0.;
const uint highlight = 0U;
#endif

const float numGradients = 2.;
const float deviationV = 0. / numGradients + .5 / numGradients;
const float elevationV = 0. / numGradients + .5 / numGradients;

vec4 getGradientColor(float position, float v, vec2 range) {
    float u = (range[0] >= range[1]) ? 0. : (position - range[0]) / (range[1] - range[0]);
    return texture(texture_gradients, vec2(u, v));
}

void main() {
    vec4 posVS = camera.localViewMatrix * node.modelLocalMatrix * position;
    gl_Position = camera.viewClipMatrix * posVS;
    vec4 color = material == 0xffU ? vec4(0) : texture(texture_materials, vec2((float(material) + .5) / 256., .5));

    if(mesh.mode == MeshMode_Points) {
        if(scene.deviationMode != 0U) {
            vec4 gradientColor = getGradientColor(deviation, deviationV, scene.deviationRange);
            if(scene.deviationMode == 1U) {
                if(gradientColor.a < 0.1)
                    return;
                color = gradientColor;
            } else if(gradientColor.a > 0.99)
                color.rgb = gradientColor.rgb;
            else if(gradientColor.a > 0.01)
                color.rgb = color0.rgb * (1.0 - gradientColor.a) + gradientColor.rgb * gradientColor.a;
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
        varyings.deviation = deviation;
    }

    varyings.positionVS = posVS.xyz;
    varyings.normalWS = normal;
    varyings.normalVS = camera.localViewMatrixNormal * normal;
    varyings.texCoord0 = texCoord0;
    varyings.linearDepth = -posVS.z;
#if defined(IOS_WORKAROUND)
    varyings.color = color;
    varyings.objectId = vec2(objectId & 0xffffU, objectId >> 16U) + 0.5;
    varyings.highlight = float(highlight);
#else
    varyingsFlat.color = color;
    varyingsFlat.objectId = objectId;
    varyingsFlat.highlight = highlight;
#endif
}
