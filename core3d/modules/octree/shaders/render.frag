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
uniform uint meshMode; // TODO: Make a #define instead?

in OctreeVaryings varyings;
#ifndef IOS_WORKAROUND
flat in OctreeVaryingsFlat varyingsFlat;
#endif

#if !defined (PICK)
layout(location = 0) out vec4 fragColor;
#else
layout(location = 1) out float fragLinearDepth;
layout(location = 2) out uvec2 fragInfo;
#endif

void main() {
    float linearDepth = -varyings.positionVS.z;
    if(linearDepth < camera.near || clip(varyings.positionVS, clipping))
        discard;

    vec4 baseColor;
    uint objectId;
    uint highlight;
#if defined(IOS_WORKAROUND)
    baseColor = varyings.color;
    objectId = uint(varyings.objectId[0]) | uint(varyings.objectId[1]) << 16U;
    highlight = uint(round(varyings.highlight));
#else
    baseColor = varyingsFlat.color;
    objectId = varyingsFlat.objectId;
    highlight = varyingsFlat.highlight;
#endif

    vec3 normalVS = normalize(varyings.normalVS);
    // compute geometric/flat normal from derivatives
    vec3 axisX = dFdx(varyings.positionVS);
    vec3 axisY = dFdy(varyings.positionVS);
    vec3 geometricNormalVS = normalize(cross(axisX, axisY));

    if(dot(normalVS, normalVS) < 0.1 || dot(normalVS, geometricNormalVS) < 0.) {
        normalVS = geometricNormalVS;
    }
    // vec3 normalWS = varyings.normalWS;
    vec3 normalWS = normalize(camera.viewLocalMatrixNormal * normalVS);

    vec4 rgba;
    if(meshMode == meshModePoints) {
        rgba = baseColor;
    } else if(meshMode == meshModeTerrain) {
        rgba = getGradientColor(textures.gradients, varyings.elevation, elevationV, scene.elevationRange);
    } else if(baseColor == vec4(0)) {
        rgba = texture(textures.base_color, varyings.texCoord0);
    } else {
        vec4 diffuseOpacity = baseColor;
        diffuseOpacity.rgb = sRGBToLinear(diffuseOpacity.rgb);

        vec4 specularShininess = vec4(mix(0.4, 0.1, baseColor.a)); // TODO: get from varyings instead
        specularShininess.rgb = sRGBToLinear(specularShininess.rgb);

        vec3 V = camera.viewLocalMatrixNormal * normalize(varyings.positionVS);
        vec3 N = normalize(normalWS);

        vec3 irradiance = texture(textures.ibl.diffuse, N).rgb;
        float perceptualRoughness = clamp((1.0 - specularShininess.a), 0.0, 1.0);
        perceptualRoughness *= perceptualRoughness;
        float lod = perceptualRoughness * (scene.iblMipCount - 1.0);
        vec3 reflection = textureLod(textures.ibl.specular, reflect(V, N), lod).rgb;

        vec3 rgb = diffuseOpacity.rgb * irradiance + specularShininess.rgb * reflection;
        rgba = vec4(rgb, baseColor.a);
    }

    if(highlight != 0U || !scene.applyDefaultHighlight) {
        float u = (float(highlight) + 0.5) / float(maxHighlights);
        mat4 colorTransform;
        colorTransform[0] = texture(textures.highlights, vec2(u, 0.5 / 5.0));
        colorTransform[1] = texture(textures.highlights, vec2(u, 1.5 / 5.0));
        colorTransform[2] = texture(textures.highlights, vec2(u, 2.5 / 5.0));
        colorTransform[3] = texture(textures.highlights, vec2(u, 3.5 / 5.0));
        vec4 colorTranslation = texture(textures.highlights, vec2(u, 4.5 / 5.0));
        rgba = colorTransform * rgba + colorTranslation;
    }

    // we put discards here (late) to avoid problems with derivative functions
    // if(meshMode == meshModePoints && distance(gl_FragCoord.xy, varyings.screenPos) > varyings.radius)
    //     discard;

#if defined (PREPASS)
    if(rgba.a < 1.)
        discard;
#else
    if(rgba.a <= 0.)
        discard;
#endif

#if defined (DITHER)
    if((rgba.a - 0.5 / 16.0) < dither(gl_FragCoord.xy))
        discard;
#endif

#if !defined(PICK)
    fragColor = rgba;
#else
    fragLinearDepth = linearDepth;
    fragInfo = uvec2(objectId, packNormalAndDeviation(normalVS.xyz, varyings.deviation));
#endif
}
