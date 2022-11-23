uniform samplerCube texBackground;
uniform samplerCube texRadiance;

layout(std140) uniform Background {
    float envBlurNormalized;
    int mipCount;
} background;

in vec3 vDir;
layout(location = 0) out vec4 fragColor;

void main() {
    vec3 color;
    if(background.envBlurNormalized == 0.) {
        color = texture(texBackground, normalize(vDir)).rgb;
    } else {
        color = textureLod(texRadiance, normalize(vDir), background.envBlurNormalized * float(background.mipCount - 1)).rgb;
    }
//    color = vec3(0, 1, 0);
    // color = (normalize(vDir) + 1.0) / 2.0;
    fragColor = vec4(color, 1);
}