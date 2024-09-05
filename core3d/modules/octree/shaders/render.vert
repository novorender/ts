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
layout(location = 7) in vec4 vertexPointFactors0;
layout(location = 8) in vec4 vertexPointFactors1;
layout(location = 9) in uint vertexHighlight;
#else
const vec3 vertexNormal = vec3(0);
const uint vertexMaterial = 0U;
const uint vertexObjectId = 0U;
const vec2 vertexTexCoord0 = vec2(0);
const vec4 vertexColor0 = vec4(1);
const vec4 vertexProjectedPos = vec4(0);
const vec4 vertexPointFactors0 = vec4(0);
const vec4 vertexPointFactors1 = vec4(0);
const uint vertexHighlight = 0U;
#endif

void main() {
    vec4 vertPos = vertexPosition;
    bool isDefined = dot(vertexProjectedPos.xyz, vertexProjectedPos.xyz) != 0.;
    if(scene.useProjectedPosition && vertexProjectedPos.w != 0. && isDefined) {
        vertPos = vertexProjectedPos;
    }
    vec4 posLS = node.modelLocalMatrix * vertPos;
    vec4 posVS = camera.localViewMatrix * posLS;
    gl_Position = camera.viewClipMatrix * posVS;

    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    varyings.toCamera = cameraPosLS - posLS.xyz;

    vec4 color = vertexMaterial == 0xffU ? vertexColor0 : texture(textures.materials, vec2((float(vertexMaterial) + .5) / 256., .5));
    mediump float pointFactor = 0.;

 #if (MODE == MODE_POINTS)
    int gradientKind = scene.defaultPointGradientKind;
    if(vertexHighlight != 0U) {
         mediump float u = (float(vertexHighlight) + 0.5) / float(maxHighlights);
         gradientKind = int(texture(textures.highlights, vec2(u, 6.5 / highLightsTextureRows)).r);
    }

    if(gradientKind != gradientKindNone) {
        if(gradientKind == gradientKindElevation) {
            pointFactor = posLS.y;
        } else {
            int offset = gradientKindDeviations0 - scene.startDeviationFactor;
            int factorIndex = gradientKind == gradientKindIntensity ? 0 : gradientKind - offset;
            pointFactor = factorIndex < 4 ? vertexPointFactors0[factorIndex] : vertexPointFactors1[factorIndex - 4];
        }

        if(gradientKind != gradientKindElevation && pointFactor == 0.) {
            if(dot(scene.undefinedPointColor, scene.undefinedPointColor) != 0.) {
                color = scene.undefinedPointColor;
            }
        } else if(gradientKind == gradientKindIntensity) {//intensity
            color = vec4(pointFactor, pointFactor, pointFactor, 1);
        } else {
            //color = vec4(pointFactor, pointFactor, pointFactor, 1);
            color = getGradientColor(textures.gradients, pointFactor, gradientKind, scene.factorRange[gradientKind]);
        }
    }


    // if(gradientKind != gradientKindNone) {
    //     if(gradientKind == gradientKindElevation) {
    //         pointFactor = posLS.y;
    //     } else {
    //         int offset = gradientKindDeviations0 - scene.startDeviationFactor;
    //         int factorIndex = gradientKind == gradientKindIntensity ? 0 : gradientKind - offset;
    //         pointFactor = factorIndex < 4 ? vertexPointFactors0[factorIndex] : vertexPointFactors1[factorIndex - 4];
    //     }

    //     if(gradientKind != gradientKindElevation && pointFactor == 0.) {
    //         if(dot(scene.undefinedPointColor, scene.undefinedPointColor) != 0.) {
    //             color = scene.undefinedPointColor;
    //         }
    //     } else if(gradientKind == gradientKindIntensity) {//intensity
    //         color = vec4(pointFactor, pointFactor, pointFactor, 1);
    //     } else if(pointFactor < scene.factorRange[gradientKind].x || pointFactor > scene.factorRange[gradientKind].y) {
    //         color = vec4(0., 0., 0., 0.);
    //     } else {
    //         color = getGradientColor(textures.gradients, pointFactor, gradientKind, scene.factorRange[gradientKind]);
    //     }
    // }

    // compute point size
    mediump float linearSize = scene.metricSize + node.tolerance * scene.toleranceFactor;
    mediump float projectedSize = max(0., camera.viewClipMatrix[1][1] * linearSize * float(camera.viewSize.y) * 0.5 / gl_Position.w);
    gl_PointSize = min(scene.maxPixelSize, max(1.0, scene.pixelSize + projectedSize));

    // Convert position to window coordinates
    vec2 halfsize = camera.viewSize * 0.5;
    varyings.screenPos = halfsize + ((gl_Position.xy / gl_Position.w) * halfsize);

    // Convert radius to window coordinates
    varyings.radius = max(1.0, gl_PointSize * 0.5);

#elif defined (HIGHLIGHT)
    if(vertexHighlight >= 0xFEU) {
        gl_Position = vec4(0); // hide 0xfe/0xff groups by outputting degenerate triangles/lines
    }
#endif

    varyings.positionLS = posLS.xyz;
    varyings.normalLS = vertexNormal;
    varyings.positionVS = posVS.xyz;
    varyings.normalVS = normalize(camera.localViewMatrixNormal * vertexNormal);
    varyings.texCoord0 = vertexTexCoord0;
    varyings.pointFactor = pointFactor;
    varyings.elevation = posLS.y;
    varyingsFlat.color = color;
#if defined (ADRENO600)
    varyingsFlat.objectId_high = vertexObjectId >> 16u;
    varyingsFlat.objectId_low = vertexObjectId & 0xffffu;
#else
    varyingsFlat.objectId = vertexObjectId;
#endif
    varyingsFlat.highlight = vertexHighlight;
}
