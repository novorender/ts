layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Background {
    BackgroundUniforms uniforms;
} background;

uniform BackgroundTextures textures;

in BackgroundVaryings varyings;

layout(location = 0) out vec4 fragColor;

void main() {
    vec3 rgb;
    if(background.uniforms.envBlurNormalized == 0.) {
        rgb = texture(textures.skybox, normalize(varyings.dir)).rgb;
    } else {
        rgb = textureLod(textures.ibl.specular, normalize(varyings.dir), background.uniforms.envBlurNormalized * float(background.uniforms.mipCount - 1)).rgb;
    }
    fragColor = vec4(rgb, 1);
}