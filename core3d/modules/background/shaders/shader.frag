layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Background {
    BackgroundUniforms background;
};

uniform BackgroundTextures textures;

in BackgroundVaryings varyings;

layout(location = 0) out mediump vec4 fragColor;

void main() {
    mediump vec3 rgb;
    if(background.envBlurNormalized == 0.) {
        rgb = texture(textures.skybox, normalize(varyings.dir)).rgb;
    } else {
        mediump float lod = background.envBlurNormalized * float(background.mipCount - 1);
        rgb = textureLod(textures.ibl.specular, normalize(varyings.dir), lod).rgb;
    }
    fragColor = vec4(rgb, 1);
}