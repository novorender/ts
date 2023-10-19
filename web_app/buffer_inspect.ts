import { vec2, type ReadonlyVec2, vec3, type ReadonlyVec3 } from "gl-matrix";
import type { DeviationSample, OutlineSample, PickSample } from "web_app";

/** Deviation lable with pixel position and deviation value as string. */
export interface DeviationLabel {
    /** Deviation value with up to 3 decimals. */
    deviation: string;
    /** X,y pixel position */
    position: vec2;
}

/** Projection, currently only cirular from the center line position, typically used for tunnels */
export type DeviationProjection = {
    /** Pixel position of center line */
    centerPoint2d: ReadonlyVec2,
    /** 3d position of center line */
    centerPoint3d: ReadonlyVec3,
}

/** Settings  for deviation inspection */
export type DeviationInspectionSettings = {
    /** Projection to use, currently only supports circular. Projection is needed to generate line through points and offset lables*/
    projection?: DeviationProjection,
    /** Option to generate line trough the deviation points, note that projection needs to also be set*/
    generateLine?: boolean
    /** Prioritize the smallest or largest deviations*/
    deviationPrioritization: "minimum" | "maximum",
}

/** Deviation values taken from screen */
export type DeviationInspections = {
    /** Spaced out lables for the most significant deviations based on settings */
    labels: DeviationLabel[],
    /** Line strip of pixel values to draw a line through the deviations on screen */
    line?: vec2[]
}

/** Sorted outlines on screen from closest to furthest from input point */
export type OutlineIntersection = {
    left: OutlineSample[],
    right: OutlineSample[],
    up: OutlineSample[],
    down: OutlineSample[],
}


/** @internal */
export function inspectDeviations(deviations: DeviationSample[], screenScaling: number, settings: DeviationInspectionSettings): DeviationInspections {
    const sortedDeviations = deviations.sort(
        (a, b) => settings.deviationPrioritization == "minimum" ? Math.abs(a.deviation) - Math.abs(b.deviation) : Math.abs(b.deviation) - Math.abs(a.deviation)
    );
    const labels: DeviationLabel[] = [];
    const linePoints: { position: vec2, position3d: ReadonlyVec3, depth: number }[] = [];
    const minLabelPixelRadius = 60;
    const minPixelRadiusLine = 40;
    const r2Label = minLabelPixelRadius * minLabelPixelRadius;
    const r2Line = minPixelRadiusLine * minPixelRadiusLine;
    const glCenterPos = settings.projection ? vec3.fromValues(settings.projection.centerPoint3d[0], settings.projection.centerPoint3d[2], -settings.projection.centerPoint3d[1]) : undefined;
    const maxDistFromCl2 = 100;
    for (let i = 0; i < sortedDeviations.length; ++i) {
        const currentSample = sortedDeviations[i];
        let addLabel = true;
        const position = vec2.fromValues(Math.round(currentSample.x / screenScaling), Math.round(currentSample.y / screenScaling));

        for (const pixel of labels) {
            const dx = pixel.position[0] - position[0];
            const dy = pixel.position[1] - position[1];
            const sqrDist = dx * dx + dy * dy;
            if (sqrDist < r2Label) {
                addLabel = false;
                break;
            }
        }
        if (addLabel && glCenterPos) {
            addLabel = vec3.squaredDistance(glCenterPos, currentSample.position) < maxDistFromCl2;
        }
        if (addLabel) {
            labels.push({ position: vec2.clone(position), deviation: currentSample.deviation.toFixed(3) })
        }
    }
    if (settings.generateLine) {
        sortedDeviations.sort((a, b) => Math.round(a.depth * 100) - Math.round(b.depth * 100));
        for (let i = 0; i < sortedDeviations.length; ++i) {
            const currentSample = sortedDeviations[i];
            const position = vec2.fromValues(Math.round(currentSample.x / screenScaling), Math.round(currentSample.y / screenScaling));

            if (settings.generateLine) {
                let addLinePoint = true;
                for (const pixel of linePoints) {
                    const sqrDist = vec2.sqrDist(pixel.position, position);
                    const depthDiff = Math.abs(pixel.depth - currentSample.depth);
                    if (sqrDist < r2Line ||
                        (depthDiff > 0.1 && vec3.sqrDist(pixel.position3d, currentSample.position) < Math.abs(pixel.depth - currentSample.depth))) //Cleanup if deep clipping plane is used
                    {
                        addLinePoint = false;
                        break;
                    }
                }
                if (addLinePoint && glCenterPos) {
                    addLinePoint = vec3.squaredDistance(glCenterPos, currentSample.position) < maxDistFromCl2;
                }
                if (addLinePoint) {
                    linePoints.push({ position, position3d: currentSample.position, depth: currentSample.depth });
                }
            }
        }
    }

    if (settings.projection) {
        for (let i = 0; i < labels.length; ++i) {
            const pos = labels[i].position;
            const dir = vec2.sub(vec2.create(), pos, settings.projection.centerPoint2d);
            vec2.normalize(dir, dir);
            vec2.scaleAndAdd(labels[i].position, pos, dir, 50);
        }


        let anglesIdxMap: { angle: number, i: number }[] = [];
        for (let i = 0; i < linePoints.length; ++i) {
            const lp = vec2.sub(vec2.create(), settings.projection.centerPoint2d, linePoints[i].position);
            vec2.normalize(lp, lp);
            let angle = Math.atan2(lp[1], lp[0]);
            if (angle < -Math.PI / 2) {
                angle += Math.PI * 2;
            }
            anglesIdxMap.push({ angle, i });
        }
        anglesIdxMap = anglesIdxMap.sort((a, b) => a.angle - b.angle);
        if (anglesIdxMap.length > 1) {
            const line: vec2[] = [];
            const line3d: ReadonlyVec3[] = [];
            let prev = linePoints[anglesIdxMap[0].i];
            line.push(prev.position);
            line3d.push(prev.position3d);
            let current = linePoints[anglesIdxMap[1].i];
            let next = linePoints[anglesIdxMap[0].i];
            let dirToPrev = vec2.sub(vec2.create(), current.position, prev.position)
            for (let i = 1; i < anglesIdxMap.length - 1; ++i) {
                next = linePoints[anglesIdxMap[i + 1].i];
                const dirToNext = vec2.sub(vec2.create(), next.position, current.position);
                const angle2d = vec2.angle(dirToPrev, dirToNext);
                if (angle2d > Math.PI * 0.6) {
                    continue;
                }
                if (vec3.squaredDistance(prev.position3d, current.position3d) > 50) {
                    continue;
                }
                line.push(current.position);
                line3d.push(current.position3d);
                prev = current;
                current = next;
                dirToPrev = dirToNext;
            }
            line.push(current.position);
            line3d.push(current.position3d);
            return { labels, line };
        }
    }
    return { labels };
}


export function outlineLaser(outlinePixels: OutlineSample[], laserPosition: ReadonlyVec2, screenScaling: number,
    perspective?: { left: ReadonlyVec2, right: ReadonlyVec2, up: ReadonlyVec2, down: ReadonlyVec2, tracerPosition3d: ReadonlyVec3 }): OutlineIntersection {

    const scaledLaserPosition = vec2.scale(vec2.create(), laserPosition, screenScaling);

    const sqDistFromLaser = (p: { x: number, y: number, position: ReadonlyVec3 }) => vec3.sqrDist(p.position, perspective!.tracerPosition3d);
    const getListUsingDirection = () => {
        const filter = (p: { x: number, y: number }, s: ReadonlyVec2, dir: ReadonlyVec2) => {
            const ps = vec2.sub(vec2.create(), vec2.fromValues(p.x, p.y), s);
            if (vec2.dot(ps, dir) < 0) {
                return false;
            }
            const d = Math.abs(dir[0] * ps[1] - dir[1] * ps[0]);
            return d < 3;
        }

        const sort = (a: { x: number, y: number, position: ReadonlyVec3 }, b: { x: number, y: number, position: ReadonlyVec3 }) =>
            sqDistFromLaser(a) - sqDistFromLaser(b);

        const l = outlinePixels.filter((p) => filter(p, scaledLaserPosition, perspective!.left)).sort((a, b) => sort(a, b));
        const r = outlinePixels.filter((p) => filter(p, scaledLaserPosition, perspective!.right)).sort((a, b) => sort(a, b));
        const d = outlinePixels.filter((p) => filter(p, scaledLaserPosition, perspective!.down)).sort((a, b) => sort(a, b));
        const u = outlinePixels.filter((p) => filter(p, scaledLaserPosition, perspective!.up)).sort((a, b) => sort(a, b));
        return { l, r, d, u };
    }

    const getListWithoutDirection = () => {
        const l = outlinePixels.filter((p) => p.x < scaledLaserPosition[0] && Math.abs(p.y - scaledLaserPosition[1]) < 2).sort((a, b) => b.x - a.x);
        const r = outlinePixels.filter((p) => p.x > scaledLaserPosition[0] && Math.abs(p.y - scaledLaserPosition[1]) < 2).sort((a, b) => a.x - b.x);
        const d = outlinePixels.filter((p) => Math.abs(p.x - scaledLaserPosition[0]) < 2 && p.y < scaledLaserPosition[1]).sort((a, b) => b.y - a.y);
        const u = outlinePixels.filter((p) => Math.abs(p.x - scaledLaserPosition[0]) < 2 && p.y > scaledLaserPosition[1]).sort((a, b) => a.y - b.y);
        return { l, r, d, u };
    }

    const { l, r, d, u } = perspective ? getListUsingDirection() : getListWithoutDirection();

    enum CheckResult {
        Discard,
        Replace,
        Add
    }

    const checkX = (ar: OutlineSample[], i: number) => {
        if (Math.abs(ar[i - 1].x - ar[i].x) < 3) {
            return Math.abs(ar[i - 1].y - scaledLaserPosition[1]) > Math.abs(ar[i - 1].y - scaledLaserPosition[1]) ? CheckResult.Replace : CheckResult.Discard;
        }
        return CheckResult.Add;
    }

    const checkY = (ar: OutlineSample[], i: number) => {
        if (Math.abs(ar[i - 1].y - ar[i].y) < 3) {
            return Math.abs(ar[i - 1].x - scaledLaserPosition[0]) > Math.abs(ar[i - 1].x - scaledLaserPosition[0]) ? CheckResult.Replace : CheckResult.Discard;
        }
        return CheckResult.Add;
    }

    const checkDir = (ar: OutlineSample[], i: number) => {
        if (Math.abs(ar[i - 1].x - ar[i].x) < 10 && Math.abs(ar[i - 1].y - ar[i].y) < 10) {
            return sqDistFromLaser(ar[i - 1]) > sqDistFromLaser(ar[i]) ? CheckResult.Replace : CheckResult.Discard;
        }
        return CheckResult.Add;
    }

    const getAr = (ar: OutlineSample[], checkFn: (ar: OutlineSample[], i: number) => CheckResult) => {
        const out: OutlineSample[] = [];
        if (ar.length > 0) {
            let startI = 0;
            let prevPos = {
                x: scaledLaserPosition[0], y: scaledLaserPosition[1]
            };
            while (startI < ar.length) {
                if (Math.abs(prevPos.x - ar[startI].x) > 10 || Math.abs(prevPos.y - ar[startI].y) > 10) {
                    out.push({ ...ar[startI], position: vec3.fromValues(ar[startI].position[0], -ar[startI].position[2], ar[startI].position[1]), x: Math.round(ar[startI].x / screenScaling), y: Math.round(ar[startI].y / screenScaling) });
                    startI++;
                    break;
                }
                prevPos = ar[startI];
                startI++;
            }
            for (let i = startI; i < ar.length; ++i) {
                const check = checkFn(ar, i);
                if (check == CheckResult.Discard) {
                    continue;
                } else if (check == CheckResult.Replace) {
                    out[out.length - 1] = { ...ar[i], position: vec3.fromValues(ar[i].position[0], -ar[i].position[2], ar[i].position[1]), x: Math.round(ar[i].x / screenScaling), y: Math.round(ar[i].y / screenScaling) };
                }
                out.push({ ...ar[i], position: vec3.fromValues(ar[i].position[0], -ar[i].position[2], ar[i].position[1]), x: Math.round(ar[i].x / screenScaling), y: Math.round(ar[i].y / screenScaling) });
            }
        }
        return out;
    }

    const left = getAr(l, perspective ? checkDir : checkX);
    const right = getAr(r, perspective ? checkDir : checkX);
    const down = getAr(d, perspective ? checkDir : checkY);
    const up = getAr(u, perspective ? checkDir : checkY);

    return { left, right, up, down };
}
