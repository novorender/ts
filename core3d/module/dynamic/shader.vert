layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Material {
    MaterialUniforms material;
};

layout(std140) uniform Instance {
    InstanceUniforms instance;
};

uniform DynamicTextures textures;

out DynamicVaryings varyings;

layout(location = 0) in vec4 vertexPosition;
layout(location = 1) in vec3 vertexNormal;
layout(location = 2) in vec4 vertexTangent;
layout(location = 3) in vec4 vertexColor0;
layout(location = 4) in vec2 vertexTexCoord0;
layout(location = 5) in vec2 vertexTexCoord1;

void main() {
    vec4 posVS = camera.localViewMatrix * instance.modelLocalMatrix * vertexPosition;
    gl_Position = camera.viewClipMatrix * posVS;
    vec3 normalLS = instance.modelLocalMatrixNormal * vertexNormal;
    vec3 tangentLS = instance.modelLocalMatrixNormal * vertexTangent.xyz;
    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    vec3 vertexPosLS = (instance.modelLocalMatrix * vertexPosition).xyz;
    vec3 bitangentLS = cross(normalLS, tangentLS.xyz) * vertexTangent.w;
    varyings.tbn = mat3(tangentLS, bitangentLS, normalLS);

    varyings.toCamera = cameraPosLS - vertexPosLS;
    varyings.texCoord0 = vertexTexCoord0;
    varyings.texCoord1 = vertexTexCoord1;
    varyings.color0 = vertexColor0;
    varyings.linearDepth = -posVS.z;
}
