import { vec2, type ReadonlyVec2, vec3, type ReadonlyVec3 } from "gl-matrix";
import type { DeviationSample, PickSample } from "web_app";

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
    const sortedDeviations = deviations.sort((a, b) => settings.deviationPrioritization == "minimum" ? Math.abs(a.deviation) - Math.abs(b.deviation) : Math.abs(b.deviation) - Math.abs(a.deviation));
    const labels: DeviationLabel[] = [];
    const linePoints: { position: vec2, position3d: ReadonlyVec3 }[] = [];
    const minLabelPixelRadius = 60;
    const minPixelRadiusLine = 20;
    const r2Label = minLabelPixelRadius * minLabelPixelRadius;
    const r2Line = minPixelRadiusLine * minPixelRadiusLine;
    const glCenterPos = settings.projection ? vec3.fromValues(settings.projection.centerPoint3d[0], settings.projection.centerPoint3d[2], -settings.projection.centerPoint3d[1]) : undefined;
    const maxDistFromCl2 = 200;
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

        if (settings.generateLine) {
            let addLinePoint = true;
            for (const pixel of linePoints) {
                const dx = pixel.position[0] - position[0];
                const dy = pixel.position[1] - position[1];
                const sqrDist = dx * dx + dy * dy;
                if (sqrDist < r2Line) {
                    addLinePoint = false;
                    break;
                }
            }
            if (addLinePoint && glCenterPos) {
                addLinePoint = vec3.squaredDistance(glCenterPos, currentSample.position) < maxDistFromCl2;
            }
            if (addLinePoint) {
                linePoints.push({ position, position3d: currentSample.position });
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
        if (anglesIdxMap.length > 0) {
            const line: vec2[] = [];
            const line3d: ReadonlyVec3[] = [];
            for (const a of anglesIdxMap) {
                if (line.length > 0) {
                    if (vec3.squaredDistance(line3d[line3d.length - 1], linePoints[a.i].position3d) > 50) {
                        continue;
                    }
                }
                line.push(linePoints[a.i].position);
                line3d.push(linePoints[a.i].position3d);
            }
            return { labels, line };
        }

    }


    return { labels };
}