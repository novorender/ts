layout(std140) uniform Camera {
    mat4 clipViewMatrix;
    mat4 viewClipMatrix;
    mat4 localViewMatrix;
    mat4 viewLocalMatrix;
    mat3 worldViewMatrixNormal;
    mat3 viewWorldMatrixNormal;
} camera;

layout(std140) uniform Material {
    vec4 baseColorFactor;
    vec3 emissiveFactor;
    float roughnessFactor;
    float metallicFactor;
    float normalScale;
    float occlusionStrength;
    float alphaCutoff;
    int baseColorUVSet;
    int metallicRoughnessUVSet;
    int normalUVSet;
    int occlusionUVSet;
    int emissiveUVSet;
    uint radianceMipCount;
} material;

layout(std140) uniform Instance {
    mat4 modelLocalMatrix;
    mat3 modelLocalMatrixNormal;
    uint objectId;
} instance;

uniform sampler2D texture_ibl_lut_ggx;
uniform samplerCube texture_ibl_diffuse;
uniform samplerCube texture_ibl_specular;
uniform sampler2D texture_base_color;
uniform sampler2D texture_metallic_roughness;
uniform sampler2D texture_normal;
uniform sampler2D texture_emissive;
uniform sampler2D texture_occlusion;

out struct {
    vec4 color0;
    vec2 texCoord0;
    vec2 texCoord1;
    float linearDepth;
    mat3 tbn; // in local space
    vec3 toCamera; // in local space (camera - position)
} varyings;

layout(location = 0) in vec4 position;
layout(location = 1) in vec3 normal;
layout(location = 2) in vec4 tangent;
layout(location = 3) in vec4 color0;
layout(location = 4) in vec2 texCoord0;
layout(location = 5) in vec2 texCoord1;

void main() {
    vec4 posVS = camera.localViewMatrix * instance.modelLocalMatrix * position;
    gl_Position = camera.viewClipMatrix * posVS;
    vec3 normalLS = instance.modelLocalMatrixNormal * normal;
    vec3 tangentLS = instance.modelLocalMatrixNormal * tangent.xyz;
    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    vec3 vertexPosLS = (instance.modelLocalMatrix * position).xyz;
    vec3 bitangentLS = cross(normalLS, tangentLS.xyz) * tangent.w;
    varyings.tbn = mat3(tangentLS, bitangentLS, normalLS);

    varyings.toCamera = cameraPosLS - vertexPosLS;
    // varyings.tangent = camera.worldViewMatrixNormal * tangent.xyz;
    varyings.texCoord0 = texCoord0;
    varyings.texCoord1 = texCoord1;
    varyings.color0 = color0;
    varyings.linearDepth = -posVS.z;
}
