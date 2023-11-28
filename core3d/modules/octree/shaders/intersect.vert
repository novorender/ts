layout(std140) uniform Camera {
    CameraUniforms camera;
};

layout(std140) uniform Clipping {
    ClippingUniforms clipping;
};

layout(std140) uniform Outline {
    OutlineUniforms outline;
};

layout(std140) uniform Node {
    NodeUniforms node;
};

vec2 intersectEdge(vec3 p0, vec3 p1) {
    float t = -p0.z / (p1.z - p0.z);
    return mix(p0.xy, p1.xy, t);
}
uniform OctreeTextures textures;

layout(location = 0) in vec4 vertexPos0;
layout(location = 1) in vec4 vertexPos1;
layout(location = 2) in vec4 vertexPos2;
layout(location = 3) in uint vertexObjectId;
layout(location = 4) in uint vertexHighlight;
flat out vec4 line_vertices;
flat out mediump vec4 color;
flat out uint object_id;

void main() {
    vec3 pos0 = (outline.localPlaneMatrix * node.modelLocalMatrix * vertexPos0).xyz;
    vec3 pos1 = (outline.localPlaneMatrix * node.modelLocalMatrix * vertexPos1).xyz;
    vec3 pos2 = (outline.localPlaneMatrix * node.modelLocalMatrix * vertexPos2).xyz;
    vec3 ab = pos1 - pos0;
    vec3 ac = pos2 - pos0;
    mediump vec3 normal = normalize(cross(ab, ac));
    vec3 z = vec3(pos0.z, pos1.z, pos2.z);
    bvec3 gt = greaterThan(z, vec3(0));
    bvec3 lt = lessThan(z, vec3(0));
    int i = 0;
    vec2 line[3];
    // does triangle straddle clipping plane?
    if(any(gt) && any(lt) && vertexHighlight < 0xfeU) {
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
        line_vertices = vec4(line[0], line[1]);
    } else {
        line_vertices = vec4(0);
    }

    vec3 rgb = outline.lineColor;

    if(vertexHighlight != 0U) {
        float u = (float(vertexHighlight) + 0.5) / float(maxHighlights);
        vec4 colorTranslation = texture(textures.highlights, vec2(u, 5.5 / 6.0));
        if(colorTranslation.a == 1.) {
            rgb = colorTranslation.rgb;
        }
    }

    color = vec4(rgb, 1. - abs(normal.z));
    object_id = vertexObjectId;
}
