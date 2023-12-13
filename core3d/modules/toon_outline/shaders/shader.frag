layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform ToonOutline {
    ToonOutlineUniforms toonOutline;
};

uniform TonemappingTextures textures;

in highp vec2 uv;
layout(location = 0) out mediump vec4 fragColor;

const mediump float horizontalSobel[5 * 5] = float[]( //
1.f, 1.f, 2.f, 1.f, 1.f, // 
2.f, 2.f, 4.f, 2.f, 2.f, //
0.f, 0.f, 0.f, 0.f, 0.f, //
-2.f, -2.f, -4.f, -2.f, -2.f, //
-1.f, -1.f, -2.f, -1.f, -1.f);

const mediump float verticalSobel[5 * 5] = float[]( //
1.f, 2.f, 0.f, -2.f, -1.f, //
1.f, 2.f, 0.f, -2.f, -1.f, //
2.f, 4.f, 0.f, -4.f, -2.f, //
1.f, 2.f, 0.f, -2.f, -1.f, //
1.f, 2.f, 0.f, -2.f, -1.f);

float getPixelOffset(int index, float pixelSize) {
    return float(index - 2) * pixelSize;
}

vec2 getUvCoord(int i, int j, vec2 uv, float pixelSizeX, float pixelSizeY) {
    return uv + vec2(getPixelOffset(i, pixelSizeX), getPixelOffset(j, pixelSizeY));
}

float objectTest(uint objectId, vec2 uv, float pixelSizeX, float pixelSizeY) {
    float horizontal = 0.f;
    float vertical = 0.f;
    for(int i = 0; i < 5; ++i) {
        for(int j = 0; j < 5; ++j) {
            int idx = i * 5 + j;
            if(idx == 12) {
                continue;
            }
            vec2 uvCoord = getUvCoord(i, j, uv, pixelSizeX, pixelSizeY);
            if(uvCoord.x < 0.f || uvCoord.y < 0.f) {
                return 0.f;
            }
            float sobelFactorH = horizontalSobel[idx];
            float sobelFactorV = verticalSobel[idx];
            float val = texture(textures.pick, uvCoord).x != objectId ? 1.f : 0.f;
            horizontal += sobelFactorH * val;
            vertical += sobelFactorV * val;
        }
    }
    return sqrt(pow(horizontal, 2.f) + pow(vertical, 2.f)) / 35.f; // use 25 instead of 35?
}

float depthTest2(float centerDepth, vec2 uv, float pixelSizeX, float pixelSizeY) {
    const float threshold = 0.02f;
    float horizontal = 0.f;
    float vertical = 0.f;
    for(int i = 0; i < 5; ++i) {
        for(int j = 0; j < 5; ++j) {
            int idx = i * 5 + j;
            if(idx == 12) {
                continue;
            }
            vec2 uvCoord = getUvCoord(i, j, uv, pixelSizeX, pixelSizeY);
            if(uvCoord.x < 0.f || uvCoord.y < 0.f) {
                return 0.f;
            }
            float sobelFactorH = horizontalSobel[idx];
            float sobelFactorV = verticalSobel[idx];
            float val = abs(centerDepth - uintBitsToFloat(texture(textures.pick, uvCoord).w)) / centerDepth > threshold ? 1.f : 0.f;
            horizontal += sobelFactorH * val;
            vertical += sobelFactorV * val;
        }
    }
    return sqrt(pow(horizontal, 2.f) + pow(vertical, 2.f)) / 35.f; // use 25 instead of 35?
}

float normalTest2(vec3 centerNormal, vec2 uv, float pixelSizeX, float pixelSizeY) {
    const float threshold = 0.05f;
    float horizontal = 0.f;
    float vertical = 0.f;
    for(int i = 0; i < 5; ++i) {
        for(int j = 0; j < 5; ++j) {
            int idx = i * 5 + j;
            if(idx == 12) {
                continue;
            }
            vec2 uvCoord = getUvCoord(i, j, uv, pixelSizeX, pixelSizeY);
            if(uvCoord.x < 0.f || uvCoord.y < 0.f) {
                return 0.f;
            }
            float sobelFactorH = horizontalSobel[idx];
            float sobelFactorV = verticalSobel[idx];
            float val = dot(centerNormal, unpackNormalAndDeviation(texture(textures.pick, uvCoord).yz).xyz) < threshold ? 1.f : 0.f;
            horizontal += sobelFactorH * val;
            vertical += sobelFactorV * val;
        }
    }

    return sqrt(pow(horizontal, 2.f) + pow(vertical, 2.f)) / 25.f;
}

void main() {
    float pixelSizeX = 1.f / camera.viewSize.x;
    float pixelSizeY = 1.f / camera.viewSize.y;

    uint objectId = texture(textures.pick, uv).x;
    float centerDepth = uintBitsToFloat(texture(textures.pick, uv).w);
    vec3 centerNormal = unpackNormalAndDeviation(texture(textures.pick, uv).yz).xyz;

    float objectEdge = toonOutline.outlineObjects ? objectTest(objectId, uv, pixelSizeX, pixelSizeY) : 0.;
    float normalEdge = 0.f;
    float depthEdge = 0.f;
    if (objectEdge < 0.8) {
        depthEdge = depthTest2(centerDepth, uv, pixelSizeX, pixelSizeY);
    }
    if(depthEdge < 0.8f && objectEdge < 0.8f) {
        normalEdge = normalTest2(centerNormal, uv, pixelSizeX, pixelSizeY);
    }
    float edge = min(0.8f, max(max(depthEdge, normalEdge), objectEdge));

    if(edge < 0.3f) {
        discard;
    }
    fragColor = vec4(0, 0, 0, 1) * edge;
    //fragColor = vec4(toonOutline.color, 1) * edge;
}
