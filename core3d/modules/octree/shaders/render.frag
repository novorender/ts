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

in OctreeVaryings varyings;
flat in OctreeVaryingsFlat varyingsFlat;

#if (PASS != PASS_PICK)
layout(location = 0) out vec4 fragColor;
#else
layout(location = 1) out uvec4 fragPick;
#endif

void main() {
    float linearDepth = -varyings.positionVS.z;
#if defined(CLIP)
    if(linearDepth < camera.near || clip(varyings.positionVS, clipping))
        discard;
#endif

    vec4 baseColor;
    uint objectId;
    uint highlight;
    baseColor = varyingsFlat.color;
    objectId = varyingsFlat.objectId;
    highlight = varyingsFlat.highlight;

    vec3 normalVS = normalize(varyings.normalVS);
    // compute geometric/flat normal from derivatives
    vec3 axisX = dFdx(varyings.positionVS);
    vec3 axisY = dFdy(varyings.positionVS);
    vec3 geometricNormalVS = normalize(cross(axisX, axisY));

    // ensure that vertex normal points in same direction as geometric normal (which always faces camera)
    if(dot(normalVS, normalVS) < 0.1 || dot(normalVS, geometricNormalVS) < 0.) {
        normalVS = geometricNormalVS;
    }
    vec3 normalWS = normalize(camera.viewLocalMatrixNormal * normalVS);
    vec3 geometricNormalWS = normalize(camera.viewLocalMatrixNormal * geometricNormalVS);

    vec4 rgba = vec4(0);
#if (MODE == MODE_POINTS)
    rgba = baseColor;
#elif (MODE == MODE_TERRAIN)
    rgba = getGradientColor(textures.gradients, varyings.elevation, elevationV, scene.elevationRange);
#elif (MODE == MODE_TRIANGLES)
    if(baseColor == vec4(0)) {
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
#endif

#if defined (HIGHLIGHT)
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
#endif

    // we put discards here (late) to avoid problems with derivative functions
#if (MODE == MODE_POINTS)
    if(distance(gl_FragCoord.xy, varyings.screenPos) > varyings.radius)
        discard;
#endif

#if (PASS == PASS_PRE)
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

#if (PASS != PASS_PICK)
    fragColor = rgba;
#else
    fragPick = uvec4(objectId, packNormalAndDeviation(geometricNormalWS, varyings.deviation), floatBitsToUint(linearDepth));
#endif
}
