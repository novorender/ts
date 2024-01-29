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
uniform NodeTextures node_textures;

in OctreeVaryings varyings;
flat in OctreeVaryingsFlat varyingsFlat;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out uvec4 fragPick;

vec2 triplanarProjection(vec3 xyz, vec3 normal) {
    vec3 n = abs(normalize(normal));
    vec3 s = sign(normal);
    // multiply by the sign of the dominant normal coordinate to mirror e.g. front, back and left, right etc.
    if(n.x > n.y && n.x > n.z)
        return vec2(-xyz.z * s.x, xyz.y);
    else if(n.y > n.z)
        return vec2(-xyz.x * s.y, xyz.z);
    else
        return vec2(xyz.x * s.z, xyz.y);
}

    // pick a perpendicular'ish u direction based on normal dominate coordinate
vec3 triplanarTangentDir(vec3 normal) {
    vec3 n = abs(normalize(normal));
    vec3 s = sign(normal);
    if(n.x > n.y && n.x > n.z)
        return vec3(0, 0, -s.x);
    else if(n.y > n.z)
        return vec3(-s.y, 0, 0);
    else
        return vec3(s.z, 0, 0);
}

mat3 triplanarTangentSpace(vec3 normal) {
    vec3 u = triplanarTangentDir(normal);
    vec3 b = normalize(cross(normal, u)); // compute bi-tangent
    vec3 t = cross(b, normal); // compute tangent
    return mat3(t, b, normal);
}

struct NormalInfo {
    vec3 ng;   // Geometric normal
    vec3 n;    // Pertubed normal
    vec3 t;    // Pertubed tangent
    vec3 b;    // Pertubed bitangent
};

const float highLightsTextureRows = 6.;

// Get normal, tangent and bitangent vectors.
// params: (all in local/world space)
// v - vector from fragment to camera
// normal - vertex normal
// uvw - texture coordinates
NormalInfo getNormalInfo(vec3 v, vec3 normal, vec3 uvw) {
    vec3 ng = normalize(normal);
    mat3 ts = triplanarTangentSpace(ng);

    // For a back-facing surface, the tangential basis vectors are negated.
    float facing = step(0., dot(v, ng)) * 2. - 1.;
    ts *= facing;
    // Compute pertubed normals:
    vec3 n;
    vec2 xy = texture(textures.normal, uvw).rg; // RG16F for signed normals
    float z = sqrt(1. - dot(xy, xy)); // compute z component from xy (to save memory and bandwith)
    n = vec3(xy, z); // tangent-space normal
    n = ts * n; // transform into world space
    n = normalize(n);

    NormalInfo info;
    info.ng = ng;
    info.t = ts[0];
    info.b = ts[1];
    info.n = n;
    return info;
}

struct MaterialInfo {
    mediump float perceptualRoughness;      // roughness value, as authored by the model creator (input to shader)
    mediump vec3 f0;                        // full reflectance color (n incidence angle)

    mediump float alphaRoughness;           // roughness mapped to a more linear change in the roughness (proposed by [2])
    mediump vec3 albedoColor;

    mediump vec3 f90;                       // reflectance color at grazing angle
    mediump float metallic;

    mediump float occlusion;
    mediump vec3 n;
    mediump vec3 baseColor; // getBaseColor()
};

MaterialInfo getMetallicRoughnessInfo(MaterialInfo info, mediump float f0_ior, vec3 uvw) {
    // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
    // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
    vec4 mrSample = texture(textures.orm, uvw);
    info.perceptualRoughness = mrSample.g;
    info.metallic = mrSample.b;
    info.occlusion = mrSample.r;

    // Achromatic f0 based on IOR.
    vec3 f0 = vec3(f0_ior);

    info.albedoColor = mix(info.baseColor.rgb * (vec3(1) - f0), vec3(0), info.metallic);
    info.f0 = mix(f0, info.baseColor.rgb, info.metallic);

    // info.perceptualRoughness = clamp(info.perceptualRoughness, 0., 1.);
    // info.metallic = clamp(info.metallic, 0., 1.);
    return info;
}

float clampedDot(vec3 x, vec3 y) {
    return clamp(dot(x, y), 0., 1.);
}

mediump vec3 getIBLRadianceGGX(mediump vec3 n, vec3 v, mediump float perceptualRoughness, mediump vec3 specularColor) {
    float NdotV = clampedDot(n, v);
    vec3 reflection = normalize(reflect(-v, n));
    vec2 brdfSamplePoint = clamp(vec2(NdotV, perceptualRoughness), vec2(0), vec2(1));
    mediump vec2 brdf = texture(textures.lut_ggx, brdfSamplePoint).rg;
    mediump float lod = perceptualRoughness * float(scene.iblMipCount);
    mediump vec4 specularSample = textureLod(textures.ibl.specular, reflection, lod);
    mediump vec3 specularLight = specularSample.rgb;
    return specularLight * (specularColor * brdf.x + brdf.y);
}

mediump vec3 getIBLRadianceLambertian(mediump vec3 n, mediump vec3 diffuseColor) {
    vec3 diffuseLight = texture(textures.ibl.diffuse, n).rgb;
    return diffuseLight * diffuseColor;
}

void main() {
    highp float linearDepth = -varyings.positionVS.z;
#if defined(CLIP)
    if(linearDepth < camera.near)
        discard;

    lowp float s = clipping.mode == clippingModeIntersection ? -1. : 1.;
    bool inside = clipping.mode == clippingModeIntersection ? clipping.numPlanes > 0U : true;
    for(lowp uint i = 0U; i < clipping.numPlanes; i++) {
        inside = inside && dot(vec4(varyings.positionVS, 1), clipping.planes[i]) * s < 0.;
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
    if(dot(normalVS, normalVS) < 0.1 || dot(normalVS, geometricNormalVS) < 0.) {
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
        rgba = baseColor = texture(node_textures.unlit_color, varyings.texCoord0);
    } else {
        rgba = baseColor;
    }

#endif

    highp vec4 textureInfo = vec4(-1);
#if defined (HIGHLIGHT)
    if(highlight == 254U) {
        discard;
    }
    if(highlight != 0U || scene.applyDefaultHighlight) {
        mediump float u = (float(highlight) + 0.5) / float(maxHighlights);
        mediump mat4 colorTransform;
        colorTransform[0] = texture(textures.highlights, vec2(u, 0.5 / highLightsTextureRows));
        colorTransform[1] = texture(textures.highlights, vec2(u, 1.5 / highLightsTextureRows));
        colorTransform[2] = texture(textures.highlights, vec2(u, 2.5 / highLightsTextureRows));
        colorTransform[3] = texture(textures.highlights, vec2(u, 3.5 / highLightsTextureRows));
        mediump vec4 colorTranslation = texture(textures.highlights, vec2(u, 4.5 / highLightsTextureRows));
        textureInfo = texture(textures.highlights, vec2(u, 5.5 / highLightsTextureRows));
        rgba = baseColor = colorTransform * rgba + colorTranslation;
    }
#endif

#if (PASS != PASS_PICK && MODE != MODE_POINTS)
    if(baseColor != vec4(0)) {
        // apply shading
#if defined (PBR)
        float array_index = textureInfo.r;
        // float array_index = float(highlight) - 2.;
        if(array_index >= 0.) {
            mediump float uvScale = textureInfo.g;
            // mediump float uvScale = .5; // TODO: get from uniforms/lut texture
            vec3 pos = varyings.positionLS;
            mediump vec3 n = varyings.normalLS;
            if(dot(n, n) < .5)
                n = cross(dFdx(pos), dFdy(pos)); // use derivatives to compute geometric normal when vertex normal is undefined/missing
            mediump vec3 v = normalize(varyings.toCamera);

            vec2 uv = triplanarProjection(pos, n);
            uv *= uvScale; // apply scale
            vec3 uvw = vec3(uv, array_index);

            MaterialInfo materialInfo;
            baseColor *= texture(textures.base_color, uvw);
            materialInfo.baseColor = baseColor.rgb;

            NormalInfo normalInfo = getNormalInfo(v, n, uvw);
            n = normalInfo.n; // used bump-mapped normal for shading

            // The default index of refraction of 1.5 yields a dielectric normal incidence reflectance of 0.04.
            mediump float ior = 1.5;
            mediump float f0_ior = .04;
            materialInfo = getMetallicRoughnessInfo(materialInfo, f0_ior, uvw);

            // Roughness is authored as perceptual roughness; as is convention, convert to material roughness by squaring the perceptual roughness.
            materialInfo.alphaRoughness = materialInfo.perceptualRoughness * materialInfo.perceptualRoughness;

            mediump float reflectance = max(max(materialInfo.f0.r, materialInfo.f0.g), materialInfo.f0.b);

            // Anything less than 2% is physically impossible and is instead considered to be shadowing. Compare to "Real-Time-Rendering" 4th editon on page 325.
            materialInfo.f90 = vec3(clamp(reflectance * 50., 0., 1.));

            // LIGHTING
            mediump vec3 f_specular = getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0);
            mediump vec3 f_diffuse = getIBLRadianceLambertian(n, materialInfo.albedoColor);
            // TODO: emissive?

            mediump vec3 color = f_diffuse + f_specular;
            color *= materialInfo.occlusion;
            rgba = vec4(color, baseColor.a);
            // rgba = vec4(materialInfo.baseColor, baseColor.a);
            // rgba.rgb = normalInfo.n * .5 + .5;
        } else
#endif
        {
            // fast, but fairly basic shading for weaker devices
            mediump vec3 V = camera.viewLocalMatrixNormal * normalize(varyings.positionVS);
            mediump vec3 N = normalize(normalWS);
            mediump vec4 diffuseOpacity = rgba;

            mediump float perceptualRoughness = mix(.1, 1., baseColor.a);
            perceptualRoughness *= perceptualRoughness;

            mediump vec3 irradiance = texture(textures.ibl.diffuse, N).rgb * perceptualRoughness;
            mediump float lod = perceptualRoughness * (scene.iblMipCount - 1.0);
            mediump vec3 reflection = textureLod(textures.ibl.specular, reflect(V, N), lod).rgb * (1. - perceptualRoughness);

            mediump vec3 rgb = diffuseOpacity.rgb * irradiance + reflection;
            rgba = vec4(rgb, rgba.a);
        }
    }
#endif

#if (PASS == PASS_PICK)
#if defined (IOS_INTERPOLATION_BUG)
    float a = round(rgba.a * 256.) / 256.; // older ipad/IOS devices don't use flat mode on float varyings and thus introduces interpolation noise that we need to round off.
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
    if(rgba.a < 1.)
        discard;
#elif (PASS != PASS_PICK)
    if(rgba.a <= 0.)
        discard;
#endif

#if defined (DITHER) && (PASS == PASS_COLOR)
    if((rgba.a - 0.5 / 16.0) < dither(gl_FragCoord.xy))
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
