layout(std140) uniform Camera {
    CameraUniforms camera;
};

// layout(std140) uniform ToonOutline {
//     ToonOutlineUniforms toonOutline;
// };

uniform TonemappingTextures textures;

in vec2 uv;
layout(location = 0) out vec4 fragColor;

    const float horizontalSobel[25] = float[](
        1., 1., 2., 1., 1.,
        2., 2.,4.,2.,2.,
        0., 0., 0., 0., 0.,
        -2., -2., -4., -2., -2.,
        - 1., -1., -2., -1., -1.);

    const float verticalSobel[25] = float[](
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

    float getPixelOffset(int index, float pixelSize) {
        switch (index) {
            case 0:
            return -pixelSize * 2.;
            case 1: 
            return -pixelSize;
            case 2:
            return 0.;
            case 3:
            return pixelSize;
            case 4: 
            return pixelSize * 2.;
        }
        return 0.;
    }

    vec2 getUvCoord(int i, int j, vec2 uv, float pixelSizeX, float pixelSizeY) {
        return uv + vec2(getPixelOffset(i, pixelSizeX), getPixelOffset(j, pixelSizeY));
    }

float depthTest2(float centerDepth, vec2 uv, float pixelSizeX, float pixelSizeY) {
    const float threshold = 0.02;
    float horizontal = 0.;
    float vertical = 0.;
    for(int i = 0; i < 5; ++i) {
        for(int j = 0; j < 5; ++j) {
            int idx = i * 5 + j;
            if(idx == 12) {
                continue;
            }
            vec2 uvCoord = getUvCoord(i, j, uv, pixelSizeX, pixelSizeY);
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


float normalTest2(vec3 centerNormal, vec2 uv, float pixelSizeX, float pixelSizeY) {

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
            vec2 uvCoord = getUvCoord(i, j, uv, pixelSizeX, pixelSizeY);
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

    float normalEdge = 0.;
    float depthEdge = depthTest2(centerDepth, uv, pixelSizeX , pixelSizeY);
     if(depthEdge < 0.8) {
         normalEdge = normalTest2(centerNormal, uv, pixelSizeX, pixelSizeY);
    }
    float edge = min(0.8, max(depthEdge, normalEdge));

    if ( edge < 0.3) {
        discard;
    }
    fragColor = vec4(0,0,0, 1) * edge;
    //fragColor = vec4(toonOutline.color, 1) * edge;
}
