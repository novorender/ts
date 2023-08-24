import { type ReadonlyVec2, vec2 } from "gl-matrix";


/** @ignore */
export interface Intersection2d {
    t: number,
    u: number,
    p: ReadonlyVec2
}


/** @ignore */
export function lineSegmentIntersection(lineA: { start: ReadonlyVec2, end: ReadonlyVec2 }, lineB: { start: ReadonlyVec2, end: ReadonlyVec2 }): Intersection2d | undefined {
    const dirA = vec2.sub(vec2.create(), lineA.end, lineA.start);
    const dirB = vec2.sub(vec2.create(), lineB.end, lineB.start);

    const axb = dirA[0] * dirB[1] - dirA[1] * dirB[0];
    const startDir = vec2.sub(vec2.create(), lineB.start, lineA.start);

    if (axb == 0) {
        return undefined;
    }

    const t = (startDir[0] * dirB[1] - startDir[1] * dirB[0]) / axb;
    const u = (startDir[0] * dirA[1] - startDir[1] * dirA[0]) / axb;

    if ((0 <= t && t <= 1) && (0 <= u && u <= 1)) {
        return {
            p: vec2.scaleAndAdd(vec2.create(), lineA.start, dirA, t), t, u
        }
    }

    return undefined;
}