layout(std140) uniform Camera {
    CameraUniforms camera;
};

// layout(std140) uniform ToonOutline {
//     ToonOutlineUniforms toonOutline;
// };

uniform TonemappingTextures textures;

in vec2 uv;
layout(location = 0) out vec4 fragColor;

    float horizontalSobel[25] = float[](
        1., 1., 2., 1., 1.,
        2., 2.,4.,2.,2.,
        0., 0., 0., 0., 0.,
        -2., -2., -4., -2., -2.,
        - 1., -1., -2., -1., -1.);

    float verticalSobel[25] = float[](
        1., 2.,  0., -2., -1.,
        1., 2.,  0., -2., -1.,
        2., 4.,  0., -4., -2.,
        1., 2.,  0., -2., -1.,
        1., 2.,  0., -2., -1.);


bool objectTest(uint objectId, vec2 bl, vec2 tr, vec2 br, vec2 tl) {
    uint obj0 = texture(textures.pick, bl).x;
    if (obj0 != objectId) {
        return true;
    }
    uint obj1 = texture(textures.pick, tr).x;
    if(obj1 != objectId) {
        return true;
    }
    uint obj2 = texture(textures.pick, br).x;
    if(obj2 != objectId) {
        return true;
    }
    uint obj3 = texture(textures.pick, tl).x;
    if(obj3 != objectId) {
        return true;
    }
    return false;
}

float depthTest2(float centerDepth, vec2[25] uv) {

    //     float f0 = 2.;
    //     float f1 = 1.;
    // float horizontalSobel[25] = float[](
    //     f0, f0,f0*2.,f0,f0,
    //     f1, f1, f1 * 2., f1, f1,
    //     0., 0., 0., 0., 0.,
    //     -f1, -f1, -f1 * 2., -f1, -f1,
    //     -f0, -f0, -f0 * 2., -f0, -f0);

    // float verticalSobel[25] = float[](
    //     f1,      f0,      0., -f0,     -f1,
    //     f1,      f0,      0., -f0,     -f1,
    //     f1 * 2., f0 * 2., 0., -f0* 2., -f1 * 2.,
    //     f1,      f0,      0., -f0,     -f1,
    //     f1,      f0,      0., -f0,     -f1);

    const float threshold = 0.02;
    float horizontal = 0.;
    float vertical = 0.;
    for(int i = 0; i < 5; ++i) {
        for(int j = 0; j < 5; ++j) {
            int idx = i * 5 + j;
            if(idx == 12) {
                continue;
            }
            vec2 uvCoord = uv[idx];
            if(uvCoord.x < 0. || uvCoord.y < 0.) {
                return 0.;
            }
            float sobelFactorH = horizontalSobel[idx];
            float sobelFactorV = verticalSobel[idx];
            float val = abs(centerDepth - uintBitsToFloat(texture(textures.pick, uvCoord).w)) / centerDepth > threshold ? 1. : 0.;
            horizontal += sobelFactorH * val;
            vertical += sobelFactorV * val;
        }
    }
    return sqrt(pow(horizontal, 2.) + pow(vertical, 2.)) / 35.;
}


float normalTest2(vec3 centerNormal, vec2[25] uv) {

    const float threshold = 0.05;
    //     float f0 = 1.;
    // float f1 = 1.;
    // float horizontalSobel[25] = float[](f0, f0, f0 * 2., f0, f0, f1, f1, f1 * 2., f1, f1, 0., 0., 0., 0., 0., -f1, -f1, -f1 * 2., -f1, -f1, -f0, -f0, -f0 * 2., -f0, -f0);

    // float verticalSobel[25] = float[](f0, f1, 0., -f0, -f1, f0, f1, 0., -f0, -f1, f0 * 2., f1 * 2., 0., -f0 * 2., -f1 * 2., f0, f1, 0., -f0, -f1, f0, f1, 0., -f0, -f0);

    float horizontal = 0.;
    float vertical = 0.;
    for(int i = 0; i < 5; ++i) {
        for(int j = 0; j < 5; ++j) {
            int idx = i * 5 + j;
            if(idx == 12) {
                continue;
            }
            vec2 uvCoord = uv[idx];
            if (uvCoord.x < 0. || uvCoord.y < 0.) {
                return 0.;
            }
            float sobelFactorH = horizontalSobel[idx];
            float sobelFactorV = verticalSobel[idx];
            float val = dot(centerNormal, unpackNormalAndDeviation(texture(textures.pick, uvCoord).yz).xyz) < threshold ? 1. : 0.;
            horizontal += sobelFactorH * val;
            vertical += sobelFactorV * val;
        }
    }

    return sqrt(pow(horizontal, 2.) + pow(vertical, 2.)) / 25.;
}


void main() {
    float pixelSizeX = 1.f / camera.viewSize.x;
    float pixelSizeY = 1.f / camera.viewSize.y;

    //uint objectId = texture(textures.pick, uv).x;
    float centerDepth = uintBitsToFloat(texture(textures.pick, uv).w);
    vec3 centerNormal = unpackNormalAndDeviation(texture(textures.pick, uv).yz).xyz;

    vec2[25] uvCoords = vec2[](
        uv + vec2(-pixelSizeX*2., pixelSizeY*2.),   uv + vec2(-pixelSizeX, pixelSizeY*2.),  uv + vec2(0., pixelSizeY*2.),  uv + vec2(pixelSizeX, pixelSizeY*2.),  uv + vec2(pixelSizeX*2., pixelSizeY*2.),
        uv + vec2(-pixelSizeX*2., pixelSizeY),      uv + vec2(-pixelSizeX, pixelSizeY),     uv + vec2(0., pixelSizeY),     uv + vec2(pixelSizeX, pixelSizeY),     uv + vec2(pixelSizeX*2., pixelSizeY),
        uv + vec2(-pixelSizeX*2., 0.),              uv + vec2(-pixelSizeX, 0.),             uv + vec2(0., 0.),             uv + vec2(pixelSizeX, 0.),             uv + vec2(pixelSizeX*2., 0.),
        uv + vec2(-pixelSizeX*2., -pixelSizeY),     uv + vec2(-pixelSizeX, -pixelSizeY),    uv + vec2(0., -pixelSizeY),    uv + vec2(pixelSizeX, -pixelSizeY),    uv + vec2(pixelSizeX*2., -pixelSizeY),
        uv + vec2(-pixelSizeX*2., -pixelSizeY*2.),  uv + vec2(-pixelSizeX, -pixelSizeY*2.), uv + vec2(0., -pixelSizeY*2.), uv + vec2(pixelSizeX, -pixelSizeY*2.), uv + vec2(pixelSizeX*2., -pixelSizeY*2.)
        );

    float normalEdge = 0.;
    float depthEdge = depthTest2(centerDepth, uvCoords);
     if(depthEdge < 0.8) {
         normalEdge = normalTest2(centerNormal, uvCoords);
    }
    float edge = min(0.8, max(depthEdge, normalEdge));

    // if ( edge < 0.2) {
    // fragColor = vec4(0, 0, 0, 1);
    // } 
    // else if (edge > 0.7) {
    // fragColor = vec4(1, 0, 0, 1);
    // }
    // else {
    // fragColor = vec4(1, 1, 1, 1) * edge;
    // }

    if ( edge < 0.3) {
        discard;
    }
    fragColor = vec4(0,0,0, 1) * edge;
    //fragColor = vec4(toonOutline.color, 1) * edge;
}
