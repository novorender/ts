layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Background {
    float envBlurNormalized;
    int mipCount;
} background;

uniform samplerCube textures_background;
uniform samplerCube textures_radiance;

struct Varyings {
    vec3 dir;
};
in Varyings varyings;

layout(location = 0) out vec4 fragColor;

void main() {
    vec3 color;
    if(background.envBlurNormalized == 0.) {
        color = texture(textures_background, normalize(varyings.dir)).rgb;
    } else {
        color = textureLod(textures_radiance, normalize(varyings.dir), background.envBlurNormalized * float(background.mipCount - 1)).rgb;
    }
//    color = vec3(0, 1, 0);
    // color = (normalize(vDir) + 1.0) / 2.0;
    fragColor = vec4(color, 1);
}