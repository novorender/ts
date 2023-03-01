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

#if !defined(PICK)
layout(location = 0) out vec4 fragColor;
#else
layout(location = 1) out float fragLinearDepth;
layout(location = 2) out uvec2 fragInfo;
#endif

void main() {
    if(varyings.linearDepth < camera.near || clip(varyings.posVS, clipping))
        discard;
#if !defined(PICK)
    fragColor = vec4(gl_FrontFacing ? varyings.color : vec3(.25), 1);
#else
    fragLinearDepth = varyings.linearDepth;
    fragInfo = uvec2(cubeId, packNormal(normalize(varyings.normal).xy));
#endif
}
