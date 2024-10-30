import { vec2, vec3, type ReadonlyVec3 } from "gl-matrix";
import type { Intersection } from "./outline_inspect";
import type { ScreenSpaceConversions } from "./screen_space_conversions";
import type { RenderContext } from "core3d";


/**
@internal
 */
function getDirections2D(laserPosition: ReadonlyVec3, width: number, height: number, convert: ScreenSpaceConversions, xDir?: ReadonlyVec3, yDir?: ReadonlyVec3, zDir?: ReadonlyVec3) {
    const xDirPos = vec3.add(vec3.create(), laserPosition, xDir ?? vec3.create());
    const yDirPos = vec3.add(vec3.create(), laserPosition, yDir ?? vec3.create());
    const zDirPos = vec3.add(vec3.create(), laserPosition, zDir ?? vec3.create());
    const points2d = convert.worldSpaceToScreenSpace([laserPosition, xDirPos, yDirPos, zDirPos], { width, height, round: false });
    if (points2d[0] === undefined) {
        return undefined;
    }
    const normalize = (dir?: vec2) => {
        if (dir && vec2.dot(dir, dir) != 0) {
            vec2.normalize(dir, dir);
            return dir;
        }
    }

    for (const point of points2d) {
        if (point) {
            point[1] = height - point[1];
        }
    }
    const xDir2d = xDir ? normalize(points2d[1] ? vec2.sub(vec2.create(), points2d[1], points2d[0]) : undefined) : undefined;
    const yDir2d = yDir ? normalize(points2d[2] ? vec2.sub(vec2.create(), points2d[2], points2d[0]) : undefined) : undefined;
    const zDir2d = zDir ? normalize(points2d[3] ? vec2.sub(vec2.create(), points2d[3], points2d[0]) : undefined) : undefined;
    return { xDir2d, yDir2d, zDir2d, laserP: points2d[0] };
}

/**
@internal
 */
function isPointOnLine(point: ReadonlyVec3, segment: { start: ReadonlyVec3; end: ReadonlyVec3, length: number }): boolean {
    const lineVec = vec3.sub(vec3.create(), segment.end, segment.start);
    const startToP = vec3.sub(vec3.create(), point, segment.start);
    const t = vec3.dot(lineVec, startToP) / vec3.dot(lineVec, lineVec);
    if (t > 0 && t < 1) {
        const epsilon = Math.max(segment.length / 20, 0.001);
        const projectedPoint = vec3.lerp(vec3.create(), segment.start, segment.end, t);
        if (vec3.dist(projectedPoint, point) < epsilon) {
            return true;
        }
    }
    return false;
}

/**
@internal
 */
export function getScreenSpaceLaserIntersections(
    {
        laserPosition,
        onlyOnOutlines,
        context,
        width,
        height,
        convert,
        xDir,
        yDir,
        zDir,
        autoAlign
    }: {
        laserPosition: ReadonlyVec3, onlyOnOutlines: boolean, context: RenderContext, width: number, height: number, convert: ScreenSpaceConversions, xDir?: ReadonlyVec3, yDir?: ReadonlyVec3, zDir?: ReadonlyVec3, autoAlign?: boolean
    }) {

    const directions = getDirections2D(laserPosition, width, height, convert, xDir, yDir, zDir);
    if (!directions) {
        return undefined;
    }
    const { xDir2d, yDir2d, zDir2d } = directions;
    if (!autoAlign || !xDir || !yDir) {
        return context.screenSpaceLaser(directions.laserP, onlyOnOutlines, xDir2d, yDir2d, zDir2d);
    }
    const normal = zDir ? zDir : vec3.cross(vec3.create(), xDir, yDir);
    const firstAtempt = context.screenSpaceLaser(directions.laserP, onlyOnOutlines, xDir2d, yDir2d, zDir2d);
    if (!firstAtempt) {
        return undefined;
    }
    const { right, left, up, down } = firstAtempt;
    const distR = right.length > 0 ? vec3.dist(right[0], laserPosition) : undefined;
    const distL = left.length > 0 ? vec3.dist(left[0], laserPosition) : undefined;
    const distU = up.length > 0 ? vec3.dist(up[0], laserPosition) : undefined;
    const distD = down.length > 0 ? vec3.dist(down[0], laserPosition) : undefined;

    const isShortest = (v: number | undefined, options: (number | undefined)[]) => {
        if (!v) {
            return false;
        }
        for (const o of options) {
            if (o && o < v) {
                return false;
            }
        }
        return true;
    }

    const getRotatedLaser = (point: ReadonlyVec3,
        testPoint1: { dist?: number, point: ReadonlyVec3[] },
        testPoint2: { dist?: number, point: ReadonlyVec3[] },
        horizontal: boolean, negate: boolean,
        closestLaser: "right" | "left" | "up" | "down",
        distance: number
    ) => {
        let newDirs: { xDir: vec3, yDir: vec3 } | undefined;
        let line1: ReadonlyVec3 | undefined;
        let line2: ReadonlyVec3 | undefined;
        const testPoint = vec3.create();
        let len = 0;
        const getDirs = (length: number, line: ReadonlyVec3, point: ReadonlyVec3) => {
            len = length;
            const newDir1 = vec3.scale(vec3.create(), line, 1 / length);
            const newDir2 = vec3.cross(vec3.create(), newDir1, normal);
            vec3.copy(testPoint, point);
            return { newDir1, newDir2 };
        }

        if (testPoint1.dist) {
            line1 = vec3.sub(vec3.create(), point, testPoint1.point[0]);
        }
        if (testPoint2.dist) {
            line2 = vec3.sub(vec3.create(), point, testPoint2.point[0]);
        }
        if (line1 && line2) {
            const l1 = vec3.len(line1);
            const l2 = vec3.len(line2);
            if (l1 < l2) {
                const { newDir1, newDir2 } = getDirs(l1, line1, testPoint1.point[0]);
                if (horizontal) {
                    if (!negate) {
                        negate = true;
                    }
                    newDirs = { yDir: newDir1, xDir: newDir2 };
                } else {
                    if (negate) {
                        negate = false;
                    }
                    newDirs = { xDir: newDir1, yDir: newDir2 };
                }
            } else if (l2) {
                const { newDir1, newDir2 } = getDirs(l2, line2, testPoint2.point[0]);
                if (horizontal) {
                    if (negate) {
                        negate = false;
                    }
                    newDirs = { yDir: newDir1, xDir: newDir2 };
                } else {
                    if (!negate) {
                        negate = true;
                    }
                    newDirs = { xDir: newDir1, yDir: newDir2 };
                }
            }
        }
        if (newDirs) {
            if (negate) {
                vec3.negate(newDirs.xDir, newDirs.xDir);
                vec3.negate(newDirs.yDir, newDirs.yDir);
            }
            const newDir2d = getDirections2D(laserPosition, width, height, convert, newDirs.xDir, newDirs.yDir, zDir);
            const secondAttempt = context.screenSpaceLaser(directions.laserP, onlyOnOutlines, newDir2d?.xDir2d, newDir2d?.yDir2d);
            if (secondAttempt && secondAttempt[closestLaser].length > 0) {
                if (isPointOnLine(secondAttempt[closestLaser][0], { start: point, end: testPoint, length: len }) &&
                    vec3.dist(laserPosition, secondAttempt[closestLaser][0]) < distance) {
                    return { ...secondAttempt, zUp: firstAtempt.zUp, zDown: firstAtempt.zDown };
                }
            }
        }
    }

    if (isShortest(distR, [distL, distU, distD])) {
        const secondAttempt = getRotatedLaser(right[0], { dist: distU, point: up }, { dist: distD, point: down }, true, false, "right", distR!);
        if (secondAttempt) {
            return secondAttempt;
        }
    } else if (isShortest(distL, [distU, distD])) {
        const secondAttempt = getRotatedLaser(left[0], { dist: distU, point: up }, { dist: distD, point: down }, true, true, "left", distL!);
        if (secondAttempt) {
            return secondAttempt;
        }
    } else if (isShortest(distU, [distD])) {
        const secondAttempt = getRotatedLaser(up[0], { dist: distR, point: right }, { dist: distL, point: left }, false, false, "up", distU!);
        if (secondAttempt) {
            return secondAttempt;
        }
    } else if (distD) {
        const secondAttempt = getRotatedLaser(down[0], { dist: distR, point: right }, { dist: distL, point: left }, false, true, "down", distD!);
        if (secondAttempt) {
            return secondAttempt;
        }
    }
    return firstAtempt;
}