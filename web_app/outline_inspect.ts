import { vec2, type ReadonlyVec3, type ReadonlyVec2 } from "gl-matrix";

/** Sorted outlines on screen from closest to furthest from input point */
export type Intersection = {
    left: ReadonlyVec3[],
    right: ReadonlyVec3[],
    up: ReadonlyVec3[],
    down: ReadonlyVec3[],
    zUp?: ReadonlyVec3[],
    zDown?: ReadonlyVec3[]
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


export function outlineLaser(lines: [ReadonlyVec2, ReadonlyVec2][], laserPosition: ReadonlyVec2, right: ReadonlyVec2, up: ReadonlyVec2, autoAlign?: "model" | "closest") {

    let r = [laserPosition, vec2.scaleAndAdd(vec2.create(), laserPosition, right, 10000)] as [ReadonlyVec2, ReadonlyVec2];
    let u = [laserPosition, vec2.scaleAndAdd(vec2.create(), laserPosition, up, 10000)] as [ReadonlyVec2, ReadonlyVec2];


    let closestDir: { dir: ReadonlyVec2, distance: number } = { dir: vec2.create(), distance: Number.MAX_SAFE_INTEGER };
    const intersect = (a: { t: number, i: number }[], b: { t: number, i: number }[], line: [ReadonlyVec2, ReadonlyVec2],
        dirs?: { dir: ReadonlyVec2, n: number }[], useClosestDirection?: boolean) => {
        for (let i = 0; i < lines.length; ++i) {
            let t = intersection(lines[i], line);
            if (t !== undefined) {
                t < 0 ? a.push({ t, i }) : b.push({ t, i });
                if (dirs || useClosestDirection) {
                    const dir = vec2.sub(vec2.create(), lines[i][1], lines[i][0]);
                    const length = vec2.len(dir);
                    if (length > 0.5) {
                        vec2.scale(dir, dir, 1 / length);
                        let add = true;
                        if (dirs) {
                            for (const d of dirs) {
                                if (Math.abs(vec2.dot(d.dir, dir)) > 0.99) {
                                    add = false;
                                    d.n++;
                                    break;
                                }
                            }
                        } else if (useClosestDirection) {
                            const distance = vec2.dist(vec2.lerp(vec2.create(), lines[i][0], lines[i][1], t), laserPosition);
                            if (distance < closestDir.distance) {
                                closestDir = { dir: vec2.clone(dir), distance };
                            }
                        }

                        if (add && dirs) {
                            dirs.push({ dir, n: 1 });
                        }
                    }
                }

            }
        }
    };

    const upIntersections: { t: number, i: number }[] = [];
    const downIntersections: { t: number, i: number }[] = [];
    const upDownDir: { dir: ReadonlyVec2, n: number }[] = [];
    intersect(downIntersections, upIntersections, u, autoAlign == "model" ? upDownDir : undefined, autoAlign == "closest");

    const rightIntersections: { t: number, i: number }[] = [];
    const leftIntersections: { t: number, i: number }[] = [];
    const rightLeftDir: { dir: ReadonlyVec2, n: number }[] = [];
    intersect(leftIntersections, rightIntersections, r, autoAlign == "model" ? rightLeftDir : undefined, autoAlign == "closest");


    const rerunIntersections = () => {
        r = [laserPosition, vec2.scaleAndAdd(vec2.create(), laserPosition, right, 10000)] as [ReadonlyVec2, ReadonlyVec2];
        u = [laserPosition, vec2.scaleAndAdd(vec2.create(), laserPosition, up, 10000)] as [ReadonlyVec2, ReadonlyVec2];
        downIntersections.length = 0;
        upIntersections.length = 0;
        rightIntersections.length = 0;
        leftIntersections.length = 0;
        intersect(downIntersections, upIntersections, u);
        intersect(leftIntersections, rightIntersections, r);
    };

    if (autoAlign == "model") {
        upDownDir.sort((a, b) => b.n - a.n);
        rightLeftDir.sort((a, b) => b.n - a.n);
        let rerun = false;

        if (upDownDir[0].n > rightLeftDir[0].n) {
            const dir = upDownDir[0].dir;
            const tan = vec2.fromValues(dir[1], -dir[0]);
            if (Math.abs(vec2.dot(tan, up)) < 0.99) {
                up = tan;
                right = dir;
                rerun = true;
            }
        } else {
            const dir = rightLeftDir[0].dir;
            const tan = vec2.fromValues(dir[1], -dir[0]);
            if (Math.abs(vec2.dot(tan, right)) < 0.99) {
                up = dir;
                right = tan;
                rerun = true;
            }
        }
        if (rerun) {
            rerunIntersections();
        }
    } else if (autoAlign == "closest") {
        const dir = closestDir.dir;
        const tan = vec2.fromValues(dir[1], -dir[0]);
        if (Math.abs(vec2.dot(tan, up)) < 0.99) {
            up = dir;
            right = tan;
            rerunIntersections();
        }
    }

    const toPoints = (intersections: { t: number, i: number }[], sortIdx: number, inverseSort: boolean) => {
        const pts: ReadonlyVec2[] = intersections.map((i) => vec2.lerp(vec2.create(), lines[i.i][0], lines[i.i][1], Math.abs(i.t)));
        pts.sort((a, b) => inverseSort ? b[sortIdx] - a[sortIdx] : a[sortIdx] - b[sortIdx]);
        const filteredPts: ReadonlyVec2[] = [];
        if (pts.length > 0) {
            let i = 0;
            for (; i < pts.length; ++i) {
                if (vec2.dist(pts[i], laserPosition) > 0.001) {
                    break;
                }
            }
            let prevVal = pts[i][sortIdx];
            filteredPts.push(pts[i++]);
            for (; i < pts.length; ++i) {
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