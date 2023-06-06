layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Material {
    MaterialUniforms material;
};

layout(std140) uniform Object {
    ObjectUniforms object;
};

uniform DynamicTextures textures;

out DynamicVaryings varyings;
flat out DynamicVaryingsFlat varyingsFlat;

layout(location = 0) in vec4 vertexPosition;
layout(location = 1) in vec3 vertexNormal;
layout(location = 2) in vec4 vertexTangent;
layout(location = 3) in vec4 vertexColor0;
layout(location = 4) in vec2 vertexTexCoord0;
layout(location = 5) in vec2 vertexTexCoord1;
layout(location = 6) in mat4x3 vertexInstanceMatrix;

void main() {
    mat4 instanceMatrix = mat4(vertexInstanceMatrix);
    mat3 instanceMatrixNormal = mat3(instanceMatrix); // TODO: normalize?
    vec4 posVS = camera.localViewMatrix * object.worldLocalMatrix * instanceMatrix * vertexPosition;
    gl_Position = camera.viewClipMatrix * posVS;
    vec3 normalLS = instanceMatrixNormal * vertexNormal;
    vec3 tangentLS = instanceMatrixNormal * vertexTangent.xyz;
    vec3 cameraPosLS = camera.viewLocalMatrix[3].xyz;
    vec3 vertexPosLS = (object.worldLocalMatrix * instanceMatrix * vertexPosition).xyz;
    vec3 bitangentLS = cross(normalLS, tangentLS.xyz) * vertexTangent.w;
    varyings.tbn = mat3(tangentLS, bitangentLS, normalLS);

    varyings.positionVS = posVS.xyz;
    varyings.toCamera = cameraPosLS - vertexPosLS;
    varyings.texCoord0 = vertexTexCoord0;
    varyings.texCoord1 = vertexTexCoord1;
    varyings.color0 = vertexColor0;
    varyings.linearDepth = -posVS.z;
    varyingsFlat.objectId = object.baseObjectId != 0xffffU ? object.baseObjectId + uint(gl_InstanceID) : object.baseObjectId;
}
