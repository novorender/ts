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
layout(location = 0) out mediump vec4 fragColor;
#else
layout(location = 1) out highp uvec4 fragPick;
#endif

void main() {
    float linearDepth = -varyings.posVS.z;
    if(linearDepth < camera.near || clip(varyings.posVS, clipping))
        discard;
#if !defined(PICK)
    fragColor = vec4(gl_FrontFacing ? varyings.color : vec3(.25f), 1);
#else
    fragPick = uvec4(cubeId, packNormal(normalize(varyings.normal).xyz), floatBitsToUint(linearDepth));
#endif
}
