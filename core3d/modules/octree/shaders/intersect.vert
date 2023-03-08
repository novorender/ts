layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Scene {
    SceneUniforms scene;
};

layout(std140) uniform Node {
    NodeUniforms node;
};

layout(location = 0) in vec4 vertexPos0;
layout(location = 1) in vec4 vertexPos1;
layout(location = 2) in vec4 vertexPos2;
layout(location = 3) in uint vertexObjectId;

flat out uvec2 line_vertices;
out float opacity;
flat out uint object_id;

vec2 intersectEdge(vec3 p0, vec3 p1) {
    float t = (-camera.near - p0.z) / (p1.z - p0.z);
    return mix(p0.xy, p1.xy, t);
}

void main() {
    vec3 posVS0 = (camera.localViewMatrix * node.modelLocalMatrix * vertexPos0).xyz;
    vec3 posVS1 = (camera.localViewMatrix * node.modelLocalMatrix * vertexPos1).xyz;
    vec3 posVS2 = (camera.localViewMatrix * node.modelLocalMatrix * vertexPos2).xyz;
    vec3 ab = posVS1 - posVS0;
    vec3 ac = posVS2 - posVS0;
    vec3 normal = normalize(cross(ab, ac));
    vec3 z = vec3(posVS0.z, posVS1.z, posVS2.z);
    bvec3 gt = greaterThan(z, vec3(-camera.near));
    bvec3 lt = lessThan(z, vec3(-camera.near));
    int i = 0;
    vec2 line[3];
    // does triangle straddle clipping plane?
    if(any(gt) && any(lt)) {
        // find intersecting edges
        if(any(gt.xy) && any(lt.xy)) {
            line[i++] = intersectEdge(posVS0, posVS1);
        }
        if(any(gt.yz) && any(lt.yz)) {
            line[i++] = intersectEdge(posVS1, posVS2);
        }
        if(any(gt.zx) && any(lt.zx)) {
            line[i++] = intersectEdge(posVS2, posVS0);
        }
    }
    if(i == 2) {
        line_vertices = uvec2(packHalf2x16(line[0]), packHalf2x16(line[1]));
    } else {
        line_vertices = uvec2(0);
    }
    opacity = 1. - abs(normal.z);
    object_id = vertexObjectId;
}
