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

layout(location = 0) out vec4 fragColor;
layout(location = 1) out uvec4 fragPick;

void main() {
    highp float linearDepth = -varyings.positionVS.z;
#if defined(CLIP)
    if(linearDepth < camera.near)
        discard;

    lowp float s = clipping.mode == clippingModeIntersection ? -1.f : 1.f;
    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;
    for(lowp uint i = 0U; i < clipping.numPlanes; i++) {
        inside = inside && dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.f;
    }
    if(clipping.mode == clippingModeIntersection ? inside : !inside) {
        discard;
    }
#endif

    mediump vec4 baseColor;
    highp uint objectId;
    lowp uint highlight;
    baseColor = varyingsFlat.color;
#if defined (ADRENO600)
    objectId = combineMediumP(varyingsFlat.objectId_high, varyingsFlat.objectId_low);
#else
    objectId = varyingsFlat.objectId;
#endif

    highlight = varyingsFlat.highlight;

    mediump vec3 normalVS = normalize(varyings.normalVS);
    // compute geometric/flat normal from derivatives
    highp vec3 axisX = dFdx(varyings.positionVS); // adreno GPU doesn't like this to be mediump, for some reason, so we use highp instead
    highp vec3 axisY = dFdy(varyings.positionVS); // ditto
    mediump vec3 geometricNormalVS = normalize(cross(axisX, axisY));

    // ensure that vertex normal points in same direction as geometric normal (which always faces camera)
    if(dot(normalVS, normalVS) < 0.1f || dot(normalVS, geometricNormalVS) < 0.f) {
        normalVS = geometricNormalVS;
    }
    mediump vec3 normalWS = normalize(camera.viewLocalMatrixNormal * normalVS);
    mediump vec3 geometricNormalWS = normalize(camera.viewLocalMatrixNormal * geometricNormalVS);

    mediump vec4 rgba = vec4(0);
#if (MODE == MODE_POINTS)
    rgba = baseColor;
#elif (MODE == MODE_TERRAIN)
    rgba = baseColor = getGradientColor(textures.gradients, varyings.elevation, elevationV, scene.elevationRange); //Modify base color to get 
#elif (MODE == MODE_TRIANGLES)
    if(baseColor == vec4(0)) {
        rgba = texture(textures.base_color, varyings.texCoord0);
    } else {
        rgba = baseColor;
    }
#endif

#if defined (HIGHLIGHT)
    if(highlight == 254U) {
        discard;
    }
    if(highlight != 0U || scene.applyDefaultHighlight) {
        mediump float u = (float(highlight) + 0.5f) / float(maxHighlights);
        mediump mat4 colorTransform;
        colorTransform[0] = texture(textures.highlights, vec2(u, 0.5f / 6.0f));
        colorTransform[1] = texture(textures.highlights, vec2(u, 1.5f / 6.0f));
        colorTransform[2] = texture(textures.highlights, vec2(u, 2.5f / 6.0f));
        colorTransform[3] = texture(textures.highlights, vec2(u, 3.5f / 6.0f));
        mediump vec4 colorTranslation = texture(textures.highlights, vec2(u, 4.5f / 6.0f));
        rgba = colorTransform * rgba + colorTranslation;
    }
#endif

#if (PASS != PASS_PICK && MODE != MODE_POINTS)
    if(baseColor != vec4(0)) {
        mediump vec4 diffuseOpacity = rgba;
        diffuseOpacity.rgb = sRGBToLinear(diffuseOpacity.rgb);

        mediump vec4 specularShininess = vec4(mix(0.4f, 0.1f, baseColor.a)); // TODO: get from varyings instead
        specularShininess.rgb = sRGBToLinear(specularShininess.rgb);

        mediump vec3 V = camera.viewLocalMatrixNormal * normalize(varyings.positionVS);
        mediump vec3 N = normalize(normalWS);

        mediump vec3 irradiance = texture(textures.ibl.diffuse, N).rgb;
        mediump float perceptualRoughness = clamp((1.0f - specularShininess.a), 0.0f, 1.0f);
        perceptualRoughness *= perceptualRoughness;
        mediump float lod = perceptualRoughness * (scene.iblMipCount - 1.0f);
        mediump vec3 reflection = textureLod(textures.ibl.specular, reflect(V, N), lod).rgb;

        mediump vec3 rgb = diffuseOpacity.rgb * irradiance + specularShininess.rgb * reflection;
        rgba = vec4(rgb, rgba.a);
    }

#endif

#if (PASS == PASS_PICK)
#if defined (IOS_INTERPOLATION_BUG)
    float a = round(rgba.a * 256.f) / 256.f; // older ipad/IOS devices don't use flat mode on float varyings and thus introduces interpolation noise that we need to round off.
#else
    float a = rgba.a;
#endif
    if(a < scene.pickOpacityThreshold)
        discard;
#endif

    // we put discards here (late) to avoid problems with derivative functions
#if (MODE == MODE_POINTS)
    if(distance(gl_FragCoord.xy, varyings.screenPos) > varyings.radius)
        discard;
#endif

#if (PASS == PASS_PRE)
    if(rgba.a < 1.f)
        discard;
#elif (PASS != PASS_PICK)
    if(rgba.a <= 0.f)
        discard;
#endif

#if defined (DITHER) && (PASS == PASS_COLOR)
    if((rgba.a - 0.5f / 16.0f) < dither(gl_FragCoord.xy))
        discard;
#endif

#if (PASS != PASS_PICK)
    fragColor = rgba;
#else
#if defined (ADRENO600)
    fragPick = uvec4(objectId, 0u, 0u, floatBitsToUint(linearDepth));
#else
    fragPick = uvec4(objectId, packNormalAndDeviation(geometricNormalWS, varyings.deviation), floatBitsToUint(linearDepth));
#endif
#endif
}
