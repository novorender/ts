layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

in CubeVaryings varyings;

layout(location = 0) out vec4 fragColor;
layout(location = 1) out float fragLinearDepth;
layout(location = 2) out uvec2 fragInfo;

bool clip(vec3 point) {
    float s = clipping.mode == modeIntersection ? -1. : 1.;
    bool inside = clipping.mode == modeIntersection ? clipping.numPlanes > 0U : true;
    for(uint i = 0U; i < clipping.numPlanes; i++) {
        inside = inside && dot(vec4(point, 1), clipping.planes[i]) * s < 0.;
    }
    return clipping.mode == modeIntersection ? inside : !inside;
}

void main() {
    if(varyings.linearDepth < camera.near || clip(varyings.posVS))
        discard;
    fragColor = vec4(gl_FrontFacing ? varyings.color : vec3(.25), 1);
    fragLinearDepth = varyings.linearDepth;
    fragInfo = uvec2(cubeId, packNormal(normalize(varyings.normal).xy));
}
