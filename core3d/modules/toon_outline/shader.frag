layout(std140) uniform Camera {
    CameraUniforms camera;
};
uniform TonemappingTextures textures;

in vec2 uv;
layout(location = 0) out vec4 fragColor;

void main() {
    if(length(gl_FragCoord.xy) > 1000.)
        discard;

    vec3 xyz = unpackNormalAndDeviation(texture(textures.pick, uv).yz).xyz;
    if(any(isnan(xyz))) {
        discard;
    } else {
    fragColor = vec4( xyz * .5 + .5, 1);
    }
}
