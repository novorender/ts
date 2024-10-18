import { updateMeshHighlights } from "core3d/modules/octree/mesh";
import { vec2, type ReadonlyVec2, vec3, type ReadonlyVec3 } from "gl-matrix";
import type { DeviationSample, OutlineSample, PickSample, WasmInstance } from "web_app";
import type { Intersection } from "./outline_inspect";

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

        if (anglesIdxMap.length > 10) {
            //Guess the max tunnel radius based on the first 10 points 
            const radBuckets: { min: number, max: number }[] = [];
            if (glCenterPos) {
                for (let i = 0; i < Math.min(10, anglesIdxMap.length); ++i) {
                    const rad = vec3.dist(linePoints[anglesIdxMap[i].i].position3d, glCenterPos);
                    let j = 0;
                    for (; j < radBuckets.length; ++j) {
                        if (Math.abs(rad - radBuckets[j].min) < 1 || Math.abs(rad - radBuckets[j].max) < 1) {
                            radBuckets[j].min = Math.min(rad, radBuckets[j].min);
                            radBuckets[j].max = Math.max(rad, radBuckets[j].max);
                            break;
                        }
                    }
                    if (j == radBuckets.length) {
                        radBuckets.push({ min: rad, max: rad });
                    }
                }
            }
            radBuckets.sort((a, b) => a.min - b.min)
            const maxTunnelStartRadius = (radBuckets[0].max + 1) * (radBuckets[0].max + 1);

            const line: vec2[] = [];
            const line3d: ReadonlyVec3[] = [];
            let i = 0;
            if (glCenterPos) {
                for (; i < anglesIdxMap.length - 1; ++i) {
                    const rad = vec3.sqrDist(linePoints[anglesIdxMap[i].i].position3d, glCenterPos);
                    if (rad < maxTunnelStartRadius) {
                        ++i;
                        break;
                    }
                }
            } else {
                i = 1;
            }
            let prev = linePoints[anglesIdxMap[i - 1].i];
            line.push(prev.position);
            line3d.push(prev.position3d);
            let current = linePoints[anglesIdxMap[i].i];
            let next = linePoints[anglesIdxMap[i - 1].i];

            let dirToPrev = vec2.sub(vec2.create(), current.position, prev.position);
            for (; i < anglesIdxMap.length - 1; ++i) {
                next = linePoints[anglesIdxMap[i + 1].i];
                const dirToNext = vec2.sub(vec2.create(), next.position, current.position);
                const angle2d = vec2.angle(dirToPrev, dirToNext);
                if (angle2d > Math.PI * 0.6) {
                    continue;
                }
                if (vec3.squaredDistance(prev.position3d, current.position3d) > 25) {
                    continue;
                }
                line.push(current.position);
                line3d.push(current.position3d);
                prev = current;
                current = next;
                dirToPrev = dirToNext;
            }
            if (vec3.squaredDistance(prev.position3d, current.position3d) < 25) {
                line.push(current.position);
                line3d.push(current.position3d);
            }
            return { labels, line };
        }
    }
    return { labels };
}
