layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Cube {
    CubeUniforms cube;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

vec2 intersectEdge(vec3 p0, vec3 p1) {
    float t = -p0.z / (p1.z - p0.z);
    return mix(p0.xy, p1.xy, t);
}

layout(location = 0) in vec4 vertexPos0;
layout(location = 1) in vec4 vertexPos1;
layout(location = 2) in vec4 vertexPos2;

flat out uvec2 line_vertices;
out float opacity;

void main() {
    vec3 pos0 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vertexPos0).xyz;
    vec3 pos1 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vertexPos1).xyz;
    vec3 pos2 = (outline.localPlaneMatrix * cube.modelLocalMatrix * vertexPos2).xyz;
    vec3 ab = pos1 - pos0;
    vec3 ac = pos2 - pos0;
    vec3 normal = normalize(cross(ab, ac));
    vec3 z = vec3(pos0.z, pos1.z, pos2.z);
    bvec3 gt = greaterThan(z, vec3(0));
    bvec3 lt = lessThan(z, vec3(0));
    int i = 0;
    vec2 line[3];
    // does triangle straddle clipping plane?
    if(any(gt) && any(lt)) {
        // find intersecting edges
        if(any(gt.xy) && any(lt.xy)) {
            line[i++] = intersectEdge(pos0, pos1);
        }
        if(any(gt.yz) && any(lt.yz)) {
            line[i++] = intersectEdge(pos1, pos2);
        }
        if(any(gt.zx) && any(lt.zx)) {
            line[i++] = intersectEdge(pos2, pos0);
        }
    }
    if(i == 2) {
        line_vertices = uvec2(packHalf2x16(line[0]), packHalf2x16(line[1]));
    } else {
        line_vertices = uvec2(0);
    }
    opacity = 1. - abs(normal.z);
}
