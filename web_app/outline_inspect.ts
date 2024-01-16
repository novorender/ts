import { vec2, type ReadonlyVec3, type ReadonlyVec2 } from "gl-matrix";

/** Sorted outlines on screen from closest to furthest from input point */
export type OutlineIntersection = {
    left: ReadonlyVec3[],
    right: ReadonlyVec3[],
    up: ReadonlyVec3[],
    down: ReadonlyVec3[],
}

function intersection(line: [ReadonlyVec2, ReadonlyVec2], dir: [ReadonlyVec2, ReadonlyVec2]) {
    const lineDir = vec2.sub(vec2.create(), line[1], line[0]);
    const laserDir = vec2.sub(vec2.create(), dir[1], dir[0]);
    const dirI = laserDir[1] == 0 ? 0 : 1;
    const dirSign = laserDir[dirI] < 0 ? -1 : 1;
    if ((lineDir[0] == 0 && laserDir[1] == 0)) {
        const t = (dir[0][1] - line[0][1]) / lineDir[1];
        if (0 < t && t < 1) {
            return (dir[0][0] < line[0][0] ? t : -t) * dirSign;
        }
    } else if (lineDir[1] == 0 && laserDir[0] == 0) {
        const t = (dir[0][0] - line[0][0]) / lineDir[0];
        if (0 < t && t < 1) {
            return (dir[0][1] < line[0][1] ? t : -t) * dirSign;
        }
    }

    const det = lineDir[0] * laserDir[1] - laserDir[0] * lineDir[1];
    if (det !== 0) {
        const t = (laserDir[1] * (dir[1][0] - line[0][0]) + (dir[0][0] - dir[1][0]) * (dir[1][1] - line[0][1])) / det;
        if ((0 < t && t < 1)) {
            const colPoint = vec2.lerp(vec2.create(), line[0], line[1], t);
            return (dir[0][dirI] < colPoint[dirI] ? t : - t) * dirSign;
        }
    }
    return undefined;
}


export function outlineLaser(lines: [ReadonlyVec2, ReadonlyVec2][], laserPosition: ReadonlyVec2, right: ReadonlyVec2, up: ReadonlyVec2) {
    const r = [laserPosition, vec2.scaleAndAdd(vec2.create(), laserPosition, right, 10000)] as [ReadonlyVec2, ReadonlyVec2];
    const u = [laserPosition, vec2.scaleAndAdd(vec2.create(), laserPosition, up, 10000)] as [ReadonlyVec2, ReadonlyVec2];
    const upIntersections: { t: number, i: number }[] = [];
    const downIntersections: { t: number, i: number }[] = [];
    for (let i = 0; i < lines.length; ++i) {
        let t = intersection(lines[i], u);
        if (t !== undefined) {
            t < 0 ? downIntersections.push({ t, i }) : upIntersections.push({ t, i });
        }
    }

    const rightIntersections: { t: number, i: number }[] = [];
    const leftIntersections: { t: number, i: number }[] = [];
    for (let i = 0; i < lines.length; ++i) {
        const t = intersection(lines[i], r);
        if (t !== undefined) {
            t < 0 ? leftIntersections.push({ t, i }) : rightIntersections.push({ t, i });
        }
    }

    const toPoints = (intersections: { t: number, i: number }[], sortIdx: number, inverseSort: boolean) => {
        const pts: ReadonlyVec2[] = intersections.map((i) => vec2.lerp(vec2.create(), lines[i.i][0], lines[i.i][1], Math.abs(i.t)));
        pts.sort((a, b) => inverseSort ? b[sortIdx] - a[sortIdx] : a[sortIdx] - b[sortIdx]);
        const filteredPts: ReadonlyVec2[] = [];
        if (pts.length > 0) {
            let prevVal = pts[0][sortIdx];
            filteredPts.push(pts[0]);
            for (let i = 1; i < pts.length; ++i) {
                if (Math.abs(pts[i][sortIdx] - prevVal) > 0.01) {
                    prevVal = pts[i][sortIdx];
                    filteredPts.push(pts[i]);
                }
            }
        }
        return filteredPts;
    }

    const upDownSortIdx = Math.abs(up[0]) > Math.abs(up[1]) ? 0 : 1;
    const righLeftSortIdx = 1 - upDownSortIdx;
    const upDownSort = up[upDownSortIdx] > 0 ? true : false;
    const rightLeftSort = right[righLeftSortIdx] > 0 ? true : false;
    return {
        up: toPoints(downIntersections, upDownSortIdx, upDownSort),
        down: toPoints(upIntersections, upDownSortIdx, !upDownSort),
        right: toPoints(rightIntersections, righLeftSortIdx, !rightLeftSort),
        left: toPoints(leftIntersections, righLeftSortIdx, rightLeftSort)
    }

}