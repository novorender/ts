layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Material {
    MaterialUniforms material;
};

layout(std140) uniform Object {
    ObjectUniforms object;
};

uniform DynamicTextures textures;

in DynamicVaryings varyings;
flat in DynamicVaryingsFlat varyingsFlat;

layout(location = 0) out mediump vec4 fragColor;
layout(location = 1) out highp uvec4 fragPick;

float clampedDot(vec3 x, vec3 y) {
    return clamp(dot(x, y), 0., 1.);
}

struct NormalInfo {
    vec3 ng;   // Geometric normal
    vec3 n;    // Pertubed normal
    vec3 t;    // Pertubed tangent
    vec3 b;    // Pertubed bitangent
};

// Get normal, tangent and bitangent vectors.
NormalInfo getNormalInfo(vec3 v) {
    vec2 UV = material.normalUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
    vec2 uv_dx = dFdx(UV);
    vec2 uv_dy = dFdy(UV);
    // we need to solve this properly for repeating octree textures
    if(length(uv_dx) <= 1e-2) {
        uv_dx = vec2(1, 0);
    }
    if(length(uv_dy) <= 1e-2) {
        uv_dy = vec2(0, 1);
    }

    vec3 t_ = (uv_dy.t * dFdx(v) - uv_dx.t * dFdy(v)) / (uv_dx.s * uv_dy.t - uv_dy.s * uv_dx.t);

    vec3 n, t, b, ng;

    vec3 axisX = dFdx(varyings.positionVS);
    vec3 axisY = dFdy(varyings.positionVS);
    vec3 geometricNormalVS = normalize(cross(axisX, axisY));

    vec3 nrm = varyings.tbn[2];
    if(dot(nrm, nrm) < .5)
        nrm = camera.viewLocalMatrixNormal * geometricNormalVS;
    ng = normalize(nrm);
    // ng = normalize(varyings.tbn[2]);
    t = normalize(t_ - ng * dot(ng, t_));
    b = cross(ng, t);

    // // Normalize eigenvectors as matrix is linearly interpolated.
    // t = normalize(varyings.tbn[0]);
    // b = normalize(varyings.tbn[1]);
    // ng = normalize(varyings.tbn[2]);

    // For a back-facing surface, the tangential basis vectors are negated.
    float facing = step(0., dot(v, ng)) * 2. - 1.;
    t *= facing;
    b *= facing;
    ng *= facing;

    // Compute pertubed normals:
    if(material.normalUVSet >= 0) {
        n = texture(textures.normal, UV).rgb * 2. - vec3(1);
        // n = texture(textures.normal, UV).rgb;
        n *= vec3(material.normalScale, material.normalScale, 1);
        n = mat3(t, b, ng) * normalize(n);
        n = normalize(n);
    } else {
        n = ng;
    }

    NormalInfo info;
    info.ng = ng;
    info.t = t;
    info.b = b;
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

    mediump vec3 n;
    mediump vec3 baseColor; // getBaseColor()
};

MaterialInfo getMetallicRoughnessInfo(MaterialInfo info, mediump float f0_ior) {
    info.metallic = material.metallicFactor;
    info.perceptualRoughness = material.roughnessFactor;

    if(material.metallicRoughnessUVSet >= 0) {
        vec2 uv = material.metallicRoughnessUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
        // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
        // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
        vec4 mrSample = texture(textures.metallic_roughness, uv);
        info.perceptualRoughness *= mrSample.g;
        info.metallic *= mrSample.b;
    }

    // Achromatic f0 based on IOR.
    vec3 f0 = vec3(f0_ior);

    info.albedoColor = mix(info.baseColor.rgb * (vec3(1) - f0), vec3(0), info.metallic);
    info.f0 = mix(f0, info.baseColor.rgb, info.metallic);

    return info;
}

mediump vec3 getIBLRadianceGGX(mediump vec3 n, vec3 v, mediump float perceptualRoughness, mediump vec3 specularColor) {
    float NdotV = clampedDot(n, v);
    vec3 reflection = normalize(reflect(-v, n));
    vec2 brdfSamplePoint = clamp(vec2(NdotV, perceptualRoughness), vec2(0), vec2(1));
    mediump vec2 brdf = texture(textures.lut_ggx, brdfSamplePoint).rg;
    mediump float lod = perceptualRoughness * float(material.radianceMipCount);
    mediump vec4 specularSample = textureLod(textures.ibl.specular, reflection, lod);
    mediump vec3 specularLight = specularSample.rgb;
    return specularLight * (specularColor * brdf.x + brdf.y);
}

mediump vec3 getIBLRadianceLambertian(mediump vec3 n, mediump vec3 diffuseColor) {
    vec3 diffuseLight = texture(textures.ibl.diffuse, n).rgb;
    return diffuseLight * diffuseColor;
}

void main() {
    mediump vec4 baseColor = material.baseColorFactor * varyings.color0;

    if(material.baseColorUVSet >= 0) {
        vec2 uv = material.baseColorUVSet < 1 ? varyings.texCoord0 : varyings.texCoord1;
        mediump vec4 bc = texture(textures.base_color, uv); // prefer using build-in SRGB hardware conversion
        // baseColor *= vec4(sRGBToLinearComplex(bc.rgb), bc.a);
        baseColor *= bc;
    }
    if(baseColor.a < material.alphaCutoff)
        discard;

    mediump vec3 v = normalize(varyings.toCamera);
    NormalInfo normalInfo = getNormalInfo(v);
    vec3 n = normalInfo.n;
    vec3 normal = normalInfo.n;
    // vec3 l = normalize(uSunDir);   // Direction from surface point to light
    // vec3 h = normalize(l + v);     // Direction of the vector between l and v, called halfway vector

    mediump vec4 outColor;

#if defined(PBR_METALLIC_ROUGHNESS)

    MaterialInfo materialInfo;
    materialInfo.baseColor = baseColor.rgb;

    // The default index of refraction of 1.5 yields a dielectric normal incidence reflectance of 0.04.
    mediump float ior = 1.5;
    mediump float f0_ior = .04;

    materialInfo = getMetallicRoughnessInfo(materialInfo, f0_ior);

    materialInfo.perceptualRoughness = clamp(materialInfo.perceptualRoughness, 0., 1.);
    materialInfo.metallic = clamp(materialInfo.metallic, 0., 1.);

    // Roughness is authored as perceptual roughness; as is convention,
    // convert to material roughness by squaring the perceptual roughness.
    materialInfo.alphaRoughness = materialInfo.perceptualRoughness * materialInfo.perceptualRoughness;

    // Compute reflectance.
    mediump float reflectance = max(max(materialInfo.f0.r, materialInfo.f0.g), materialInfo.f0.b);

    // Anything less than 2% is physically impossible and is instead considered to be shadowing. Compare to "Real-Time-Rendering" 4th editon on page 325.
    materialInfo.f90 = vec3(clamp(reflectance * 50., 0., 1.));

    materialInfo.n = n;

    // LIGHTING
    mediump vec3 f_specular = vec3(0);
    mediump vec3 f_diffuse = vec3(0);
    mediump vec3 f_emissive = vec3(0);

    f_specular += getIBLRadianceGGX(n, v, materialInfo.perceptualRoughness, materialInfo.f0);
    f_diffuse += getIBLRadianceLambertian(n, materialInfo.albedoColor);

    // float NdotL = clampedDot(n, l);
    // float NdotV = clampedDot(n, v);
    // float NdotH = clampedDot(n, h);
    // float LdotH = clampedDot(l, h);
    // float VdotH = clampedDot(v, h);

    // vec3 intensity = vec3(uSunBrightness);

    // if(NdotL > 0. || NdotV > 0.) {
    //     // Calculation of analytical light
    //     //https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#acknowledgments AppendixB
    //     f_specular += intensity * NdotL * BRDF_specularGGX(materialInfo.f0, materialInfo.f90, materialInfo.alphaRoughness, VdotH, NdotL, NdotV, NdotH);
    //     f_diffuse += intensity * NdotL * BRDF_lambertian(materialInfo.f0, materialInfo.f90, materialInfo.albedoColor, VdotH);
    // }

    f_emissive = material.emissiveFactor;
    if(material.emissiveUVSet >= 0) {
        vec2 uv = material.emissiveUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
        f_emissive *= sRGBToLinear(texture(textures.emissive, uv).rgb);
    }

    mediump vec3 color = (f_emissive + f_diffuse + f_specular) + ambientLight * materialInfo.albedoColor;
    // mediump vec3 color = f_specular;
    // color = vec3(materialInfo.perceptualRoughness);

    // Apply optional PBR terms for additional (optional) shading
    if(material.occlusionUVSet >= 0) {
        vec2 uv = material.occlusionUVSet == 0 ? varyings.texCoord0 : varyings.texCoord1;
        mediump float ao = texture(textures.occlusion, uv).r;
        color = mix(color, color * ao, material.occlusionStrength);
    }

    outColor.rgb = color;
    outColor.a = baseColor.a;

#else

    outColor = baseColor;
    // outColor = texture(textures.base_color, varyings.texCoord0);

#endif

    fragColor = outColor;
    // only write to pick buffers for opaque triangles (for devices without OES_draw_buffers_indexed support)
    if(outColor.a >= 0.99) {
#if defined (ADRENO600)
        fragPick = uvec4(combineMediumP(varyingsFlat.objectId_high, varyingsFlat.objectId_low), packNormal(normal), floatBitsToUint(varyings.linearDepth));
#else
        fragPick = uvec4(varyingsFlat.objectId, packNormal(normal), floatBitsToUint(varyings.linearDepth));
#endif
    }
}
