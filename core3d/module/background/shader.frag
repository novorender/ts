layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Background {
    float envBlurNormalized;
    int mipCount;
} background;

uniform samplerCube textures_skybox;
uniform samplerCube textures_diffuse;

in struct Varyings {
    vec3 dir;
} varyings;

layout(location = 0) out vec4 color;

void main() {
    vec3 rgb;
    if(background.envBlurNormalized == 0.) {
        rgb = texture(textures_skybox, normalize(varyings.dir)).rgb;
    } else {
        rgb = textureLod(textures_diffuse, normalize(varyings.dir), background.envBlurNormalized * float(background.mipCount - 1)).rgb;
    }
    color = vec4(rgb, 1);
}