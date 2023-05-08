layout(std140) uniform Camera {
    CameraUniforms camera;
};
uniform TonemappingTextures textures;

in vec2 uv;
layout(location = 0) out vec4 fragColor;

float depthTest(float centerDepth, vec2 bl, vec2 tr, vec2 br, vec2 tl,vec2 tc,vec2 bc, vec2 lc,vec2 rc) {
    float dtl = uintBitsToFloat(texture(textures.pick, tl).w);
    float dtc = uintBitsToFloat(texture(textures.pick, tc).w);
    float dtr = uintBitsToFloat(texture(textures.pick, tr).w);

    float dlc = uintBitsToFloat(texture(textures.pick, lc).w);
    float drc = uintBitsToFloat(texture(textures.pick, rc).w);

    float dbl = uintBitsToFloat(texture(textures.pick, bl).w);
    float dbc = uintBitsToFloat(texture(textures.pick, bc).w);
    float dbr = uintBitsToFloat(texture(textures.pick, br).w);

    if(isinf(dbl) && isinf(dtr) && isinf(dbr) && isinf(dtl) && isinf(dtc) && isinf(dbc)) {
        return -1.;
    }

    float horizontal = abs(dtl + (dtc * 2.) + dtr - dbl - (dbc * 2.) - dbr) / centerDepth;  
    float vertical = abs(dtl + (dlc * 2.) + dbl - dtr - (drc * 2.) - dbr) / centerDepth;  

    return sqrt(pow(horizontal, 2.) + pow(vertical, 2.)); 
}

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

float normalTest(vec2 bl, vec2 tr, vec2 br, vec2 tl) {
    vec3 normal0 = unpackNormalAndDeviation(texture(textures.pick, bl).yz).xyz;
    vec3 normal1 = unpackNormalAndDeviation(texture(textures.pick, tr).yz).xyz;
    vec3 normal2 = unpackNormalAndDeviation(texture(textures.pick, br).yz).xyz;
    vec3 normal3 = unpackNormalAndDeviation(texture(textures.pick, tl).yz).xyz;
    if(any(isnan(normal0)) || any(isnan(normal1)) || any(isnan(normal2)) || any(isnan(normal3))) {
        return 0.;
    }
    // vec3 normalDiff0 = normal1 - normal0;
    // vec3 normalDiff1 = normal3 - normal2;
    // float edgeNormal = sqrt(dot(normalDiff0, normalDiff0) + dot(normalDiff1, normalDiff1));
    // return edgeNormal > 0.4;

     float normalDiff0 = 1.0 - dot(normal1, normal0);
     float normalDiff1 = 1.0 - dot(normal3, normal2);
     return (normalDiff0 + normalDiff1) * 3.;
}

void main() {
    float pixelSizeX = 1.f / camera.viewSize.x;
    float pixelSizeY = 1.f / camera.viewSize.y;

    uint objectId = texture(textures.pick, uv).x;
    float linearDepth = uintBitsToFloat(texture(textures.pick, uv).w);
    vec3 xyz = unpackNormalAndDeviation(texture(textures.pick, uv).yz).xyz;

    vec2 bottomLeftUV = uv + vec2(-pixelSizeX, -pixelSizeY);
    vec2 topRightUV = uv + vec2(pixelSizeX, pixelSizeY);
    vec2 bottomRightUV = uv + vec2(pixelSizeX, -pixelSizeY);
    vec2 topLeftUV = uv + vec2(pixelSizeX, -pixelSizeY);
    vec2 topCenter = uv + vec2(0, pixelSizeY);
    vec2 bottomCenter = uv + vec2(0, -pixelSizeY);
    vec2 leftCenter = uv + vec2(-pixelSizeX, 0);
    vec2 rightCenter = uv + vec2(pixelSizeX, 0);

    float edge = 0.;
    //bool edge = objectTest(objectId, bottomLeftUV, topRightUV, bottomRightUV, topLeftUV);

    //float t = depthTest(linearDepth, bottomLeftUV, topRightUV, bottomRightUV, topLeftUV);
    edge +=  depthTest(linearDepth, bottomLeftUV, topRightUV, bottomRightUV, topLeftUV,topCenter, bottomCenter, leftCenter, rightCenter );
    // if (edge >= 0.){
    //     edge += normalTest(bottomLeftUV, topRightUV, bottomRightUV, topLeftUV);
    // }
    edge = min(edge, 0.8);

    // if ( edge < 0.3) {
    // fragColor = vec4(0, 0, 0, 1);
    // } 
    // else {
    // fragColor = vec4(1, 1, 1, 1) * edge;
    // }



    if ( edge < 0.3) {
        discard;
    }

    // if (edge  > 0.8) {
    //   fragColor = vec4(1, 0, 0, 1);
    // } else {
    // fragColor = vec4(0, 0, 0, 1) * edge;
    // }
    fragColor = vec4(0, 0, 0, 1) * edge;

    // if(any(isnan(xyz))) {
    //     discard;
    // } else {
    // fragColor = vec4( xyz * .5 + .5, 1);
    // }
}
