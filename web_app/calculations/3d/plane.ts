import type { ReadonlyVec4, ReadonlyVec3 } from "gl-matrix";
import { vec3 } from "gl-matrix";

/**
 * Calculate the intersection point between ray and plane
 * @public
 * @param segment segment as an array with start and end point
 * @param plane choose if planes under clipping or outlines should be used
 * @returns vector of the intersection point, undefined if plane and segment never intersects
 */
export function segmentPlaneIntersection(segment: [ReadonlyVec3, ReadonlyVec3], plane: ReadonlyVec4) {
    const [nx, ny, nz] = plane;
    const planeDir = vec3.fromValues(nx, ny, nz);

    const rayDir = vec3.sub(vec3.create(), segment[0], segment[1]);
    const d = vec3.dot(planeDir, rayDir);
    if (d != 0) {
        const t = (plane[3] - vec3.dot(planeDir, segment[0])) / d;
        if (t > 0) {
            return undefined;
        }
        return vec3.scaleAndAdd(vec3.create(), segment[0], rayDir, t);
    }
    return undefined;
}