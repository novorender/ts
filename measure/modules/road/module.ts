import type { Alignment, DrawObject, DrawPart, HorizontalAlignment, StationDrawObject, StationInfo, StationsDrawObject, StationSegment, StationSegmentDrawObject, StationSegmentInfo, } from "..";
import { BaseModule } from "../base";
import { vec3, type ReadonlyVec3 } from "gl-matrix";
import { FillDrawInfo2D, FillDrawInfo2DOnPart } from "../draw/module";
import type { ObjectId } from "data";
import { closestPointToLine } from "measure/worker/util";
import type { CurvatureKind } from "measure/worker/brep";

function infoBetweenStations(
    alignment: Alignment,
    start: number,
    end: number,
    slope?: boolean,
    length?: boolean,
    vertices?: ReadonlyVec3[]): StationSegmentInfo | undefined {

    let index = 1;
    start = Math.max(alignment.stations[0], start);
    const startPoint = vec3.create();
    const endPoint = vec3.create();
    let segLength = 0;
    for (; index < alignment.stations.length; ++index) {
        const stationEnd = alignment.stations[index];
        if (stationEnd < start) {
            continue;
        }

        const stationStart = alignment.stations[index - 1];
        vec3.lerp(startPoint, alignment.points[index - 1], alignment.points[index], (start - stationStart) / (stationEnd - stationStart));
        if (vertices) {
            vertices.push(startPoint);
        }

        if (stationEnd >= end) {
            vec3.lerp(endPoint, alignment.points[index - 1], alignment.points[index], (end - stationStart) / (stationEnd - stationStart));
            if (vertices) {
                vertices.push(endPoint);
            }
            const segLength = length ? vec3.dist(startPoint, endPoint) : undefined;
            const segSlope = slope ? (endPoint[2] - startPoint[2]) / (end - start) : undefined;
            return { slope: segSlope, length: segLength, startPoint, endPoint, startStation: start, endStation: end }
        }

        if (length) {
            segLength += vec3.dist(startPoint, alignment.points[index]);
        }
        if (vertices) {
            vertices.push(alignment.points[index]);
        }
        ++index;
        break;
    }
    if (index == alignment.stations.length) {
        return undefined;
    }
    for (; index < alignment.stations.length; ++index) {
        const stationEnd = alignment.stations[index];
        const stationStart = alignment.stations[index - 1];
        if (stationEnd >= end) {
            vec3.lerp(endPoint, alignment.points[index - 1], alignment.points[index], (end - stationStart) / (stationEnd - stationStart));
            if (length) {
                segLength += vec3.dist(alignment.points[index - 1], endPoint);
            }
            if (vertices) {
                vertices.push(endPoint);
            }
            const segSlope = slope ? (endPoint[2] - startPoint[2]) / (end - start) : undefined;
            return { slope: segSlope, length: length ? segLength : undefined, startPoint, endPoint, startStation: start, endStation: end }
        }
        if (length) {
            segLength += vec3.dist(alignment.points[index - 1], alignment.points[index]);
        }
        if (vertices) {
            vertices.push(alignment.points[index]);
        }
    }
    vec3.copy(endPoint, alignment.points[alignment.points.length - 1]);
    const segSlope = slope ? (endPoint[2] - startPoint[2]) / (end - start) : undefined;
    return { slope: segSlope, length: length ? segLength : undefined, startPoint, endPoint, startStation: start, endStation: end }
}

/**
 * Module for handling road spesific parametric data. 
 */
export class RoadModule extends BaseModule {
    async getAlignment(objectId: ObjectId): Promise<Alignment | undefined> {
        const workerScene = await this.worker;
        return await workerScene.getAlignment(objectId);
    }

    getHorizontalDrawItem(alignment: Alignment, curvatureColors?: Map<CurvatureKind, string>, context = this.parent.draw.drawContext): HorizontalAlignment {
        const segmentParts: DrawPart[] = [];
        let segmentVertices: ReadonlyVec3[] = [];
        let curvatureIdx = 0;
        for (let i = 0; i < alignment.points.length; ++i) {
            if (curvatureIdx < alignment.horizontalPointsOfCurvature.length &&
                alignment.horizontalPointsOfCurvature[curvatureIdx].index == i) {
                const pointOfCurvature = alignment.horizontalPointsOfCurvature[curvatureIdx];
                segmentVertices.push(alignment.points[i]);
                segmentParts.push({ drawType: "lines", vertices3D: segmentVertices, color: curvatureColors?.get(pointOfCurvature.kind) });
                segmentVertices = [];
                ++curvatureIdx;
            }
            segmentVertices.push(alignment.points[i]);
        }
        segmentParts.push({ drawType: "lines", vertices3D: segmentVertices });
        const segment = { kind: "curveSegment", parts: segmentParts } as DrawObject;
        const curvatureChangePoints: ReadonlyVec3[] = [];
        const curvatureMidPoints: ReadonlyVec3[] = [];
        const curvatureInfo: string[] = [];
        for (let i = 0; i < alignment.horizontalPointsOfCurvature.length; ++i) {
            const point = alignment.horizontalPointsOfCurvature[i];
            curvatureChangePoints.push(point.point);
            if (i !== 0 && point.parameter) {
                const prevPoint = alignment.horizontalPointsOfCurvature[i - 1];
                curvatureMidPoints.push(vec3.lerp(vec3.create(), prevPoint.point, point.point, 0.5));
                curvatureInfo.push(`r=${point.parameter.toFixed(2)}m`);
            }
        }
        const pointsOfCurvature = { drawType: "vertex", vertices3D: curvatureChangePoints } as DrawPart;
        const curvatures = { drawType: "text", vertices3D: curvatureMidPoints, text: [curvatureInfo] } as DrawPart;


        const horizontalAlignment = { segment, pointsOfCurvature, curvatures };

        this.updateHorizontalDrawItem(horizontalAlignment, context);
        return horizontalAlignment;
    }

    updateHorizontalDrawItem(alignment: HorizontalAlignment, context = this.parent.draw.drawContext) {
        FillDrawInfo2D(context, [alignment.segment]);
        FillDrawInfo2DOnPart(context, alignment.pointsOfCurvature);
        FillDrawInfo2DOnPart(context, alignment.curvatures);
    }

    getStationsDrawObject(alignment: Alignment, interval: number, start?: number, elevation?: boolean, slopes?: boolean): StationsDrawObject {
        const showStationAbove = 0.01;
        const minorTickFreq = 5;
        const minorTickInterval = interval / minorTickFreq;

        const stationLines: DrawPart[] = [];
        const stationMinorLines: DrawPart[] = [];

        let nextParam = start ?? Math.ceil(alignment.stations[0] / minorTickInterval) * minorTickInterval;
        const stations: { position: ReadonlyVec3, direction: ReadonlyVec3, stationInfo: string, param: number }[] = [];

        for (let i = 1; i < alignment.stations.length;) {
            const stationEnd = alignment.stations[i];
            if (stationEnd < nextParam) {
                ++i;
                continue;
            }
            const isMinorTick = nextParam % interval !== 0;
            const stationStart = alignment.stations[i - 1];
            const dir = vec3.sub(vec3.create(), alignment.points[i], alignment.points[i - 1]);
            vec3.normalize(dir, dir);
            const crossIdx = Math.abs(dir[2]) < Math.cos(0.08726646) ? 2 : 1; // 0.08726646 is 5deg
            const up = vec3.fromValues(0, 0, 0);
            up[crossIdx] = 1;
            const side = vec3.cross(vec3.create(), up, dir);
            vec3.normalize(side, side);

            const stationPosition = vec3.lerp(vec3.create(), alignment.points[i - 1], alignment.points[i],
                (nextParam - stationStart) / (stationEnd - stationStart));

            const tickOffset = isMinorTick ? 2 : 5;
            const lineVertices = [vec3.scaleAndAdd(vec3.create(), stationPosition, side, tickOffset), vec3.scaleAndAdd(vec3.create(), stationPosition, side, -tickOffset)];
            if (isMinorTick) {
                stationMinorLines.push({ drawType: "lines", vertices3D: lineVertices });
            } else {
                stationLines.push({ drawType: "lines", vertices3D: lineVertices });

                let stationInfo = nextParam.toFixed(0);
                if (elevation) {
                    stationInfo += ", z=" + stationPosition[2].toFixed(2);
                } if (slopes) {
                    const info = infoBetweenStations(alignment, nextParam - interval, nextParam, true);
                    if (info?.slope && Math.abs(info.slope) > showStationAbove) {
                        stationInfo += ", S " + (info.slope * 100).toFixed(0) + "%"
                    }
                }
                stations.push({ position: stationPosition, direction: vec3.negate(vec3.create(), side), stationInfo, param: nextParam });
            }

            nextParam += minorTickInterval;
        }
        return {
            stationLines,
            stationMinorLines,
            stationInfo: { drawType: "text", vertices3D: stations.map(s => s.position), directions3D: stations.map(s => s.direction), text: [stations.map(s => s.stationInfo)] },
            stationInfoProfiles: stations.map(s => s.param)
        };
    }

    updateStationsDrawObject(stations: StationsDrawObject, context = this.parent.draw.drawContext) {
        FillDrawInfo2DOnPart(context, stations.stationInfo);
        for (const part of stations.stationLines) {
            FillDrawInfo2DOnPart(context, part);
        }
        for (const part of stations.stationMinorLines) {
            FillDrawInfo2DOnPart(context, part);
        }
    }

    getStationSegment(alignment: Alignment, station: number, type: "horizontal" | "vertical"): StationSegment | undefined {
        const segments = type == "horizontal" ? alignment.horizontalPointsOfCurvature : alignment.verticalPointsOfCurvature;
        if (segments.length == 0) {
            return undefined;
        }
        if (station < segments[0].station) {
            return { start: alignment.stations[0], end: segments[0].station, curvature: segments[0].parameter };
        }
        for (let i = 1; i < segments.length; ++i) {
            const start = segments[i - 1];
            const end = segments[i];
            if (station >= start.station && station <= end.station) {
                return { start: start.station, end: end.station, curvature: end.parameter };
            }
        }
        return undefined;
    }

    getStationSectionDrawObject(alignment: Alignment, stationStart: number, stationEnd: number,
        settings?: { curvature?: number, length?: boolean, slope?: boolean, elevation?: boolean },
        context = this.parent.draw.drawContext): StationSegmentDrawObject | undefined {
        const vertices: ReadonlyVec3[] = [];
        const stationSegment = infoBetweenStations(alignment, stationStart, stationEnd, settings?.slope, settings?.length, vertices);
        if (stationSegment) {
            const segment = { drawType: "lines", vertices3D: vertices } as DrawPart;
            const startLabel = stationStart.toFixed(2) + (settings?.elevation ? ` z=${vertices[0][2].toFixed(2)}` : "");
            const endLabel = stationEnd.toFixed(2) + (settings?.elevation ? ` z=${vertices[vertices.length - 1][2].toFixed(2)}` : "");
            const stations = {
                drawType: "text",
                vertices3D: [stationSegment.startPoint, stationSegment.endPoint],
                text: [[startLabel, endLabel]]
            } as DrawPart;
            let labelTexts: string[] = [];
            if (settings?.curvature) {
                labelTexts.push(`r=${settings.curvature.toFixed(1)}m`);
            }
            if (stationSegment.length) {
                labelTexts.push(`${stationSegment.length.toFixed(2)}m`);
            }
            if (stationSegment.slope) {
                labelTexts.push(`${(stationSegment.slope * 100).toFixed(2)}%`);
            }
            let labels: DrawPart | undefined;
            if (labelTexts.length > 0) {
                labels = {
                    drawType: "text",
                    vertices3D: [vec3.lerp(vec3.create(),
                        stationSegment.startPoint, stationSegment.endPoint, 0.5)],
                    text: [labelTexts]
                } as DrawPart;
            }

            const section = { segment, stations, labels };
            this.updateSectionDrawObject(section, context)
            return section;
        }
    }

    updateSectionDrawObject(segment: StationSegmentDrawObject, context = this.parent.draw.drawContext) {
        FillDrawInfo2DOnPart(context, segment.segment);
        FillDrawInfo2DOnPart(context, segment.stations);
        if (segment.labels) {
            FillDrawInfo2DOnPart(context, segment.labels);
        }
    }

    getStationInfoAtPoint(alignment: Alignment, point: ReadonlyVec3): StationInfo | undefined {
        let closestDist: { t: number, startIdx: number, distance: number, projectedPoint: ReadonlyVec3 } | undefined;
        for (let i = 1; i < alignment.points.length; ++i) {
            const projectedPoint = closestPointToLine(point, alignment.points[i - 1], alignment.points[i]);
            const distance = vec3.distance(projectedPoint.pos, point);
            if (closestDist === undefined || closestDist.distance > distance) {
                closestDist = { t: projectedPoint.parameter, startIdx: i - 1, distance, projectedPoint: projectedPoint.pos };
            }
        }
        if (closestDist) {
            const lineStart = alignment.points[closestDist.startIdx];
            const lineEnd = alignment.points[closestDist.startIdx + 1];
            const direction = vec3.sub(vec3.create(), lineEnd, lineStart);
            vec3.normalize(direction, direction);

            const stationStart = alignment.stations[closestDist.startIdx];
            const stationEnd = alignment.stations[closestDist.startIdx + 1];

            const lineLen = stationEnd - stationStart;
            const station = stationStart + (lineLen * closestDist.t);

            return { station, direction, point: closestDist.projectedPoint };
        }
        return undefined;
    }

    getStationDrawObject(info: StationInfo, elevation?: boolean, context = this.parent.draw.drawContext): StationDrawObject {
        const parts: DrawPart[] = [];
        const infoText: string[] = [info.station.toFixed(2)];
        if (elevation) {
            infoText.push(`z=${info.point[2].toFixed(2)}`);
        }
        parts.push({ drawType: "text", vertices3D: [info.point], text: [infoText] });
        parts.push({ drawType: "vertex", vertices3D: [info.point] });

        const direction = {
            drawType: "lines",
            vertices3D: [info.point, vec3.scaleAndAdd(vec3.create(), info.point, info.direction, 10)]
        } as DrawPart;

        const object = { kind: "complex", parts } as DrawObject;

        FillDrawInfo2D(context, [object]);
        FillDrawInfo2DOnPart(context, direction);
        return { info: object, direction };
    }

    updateStationDrawObject(drawObject: StationDrawObject, context = this.parent.draw.drawContext) {
        FillDrawInfo2DOnPart(context, drawObject.direction);
        FillDrawInfo2D(context, [drawObject.info]);
    }

    getPointAtStation(alignment: Alignment, station: number): ReadonlyVec3 {
        for (let i = 1; i < alignment.stations.length; ++i) {
            const stationEnd = alignment.stations[i];
            if (station < stationEnd) {
                const stationStart = alignment.stations[i - 1];
                const t = (station - stationStart) / (stationEnd - stationStart);
                return vec3.lerp(vec3.create(), alignment.points[i - 1], alignment.points[i], t);
            }
        }
        return alignment.points[alignment.points.length - 1];
    }
}