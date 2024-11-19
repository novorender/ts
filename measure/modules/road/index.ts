import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix"
import type { DrawObject, DrawPart, DrawProduct } from "measure";
import type { CurvatureKind } from "measure/worker/brep";
export { RoadModule } from "./module";

export type SlopeSegment = {
    horizontalIndexFrom: number, horizontalIndexTo: number, verticalAlignmentIndex: number, slope: number
}

export type HorizonalPointOfCurvature = {
    station: number, point: ReadonlyVec3, index: number, kind: CurvatureKind, parameter?: number
}

export type VerticalPointOfCurvature = {
    station: number, height: number, kind: CurvatureKind, parameter?: number
}

export interface Alignment {
    readonly objectId: number;
    readonly points: ReadonlyVec3[];
    readonly stations: number[];
    readonly top: number;
    readonly bottom: number;
    readonly horizontalPointsOfCurvature: HorizonalPointOfCurvature[];
    readonly verticalPointsOfCurvature: VerticalPointOfCurvature[];
    readonly verticalAlignment: ReadonlyVec2[];
}

export interface HorizontalAlignment {
    segment: DrawObject;
    pointsOfCurvature: DrawPart;
    curvatures: DrawPart;
}

export interface StationInfo {
    station: number,
    point: ReadonlyVec3,
    direction: ReadonlyVec3
}

export interface StationDrawObject {
    info: DrawObject;
    direction: DrawPart;
}

export interface StationSegment {
    start: number,
    end: number,
    curvature?: number
}

export interface StationSegmentInfo {
    startStation: number,
    endStation: number,
    startPoint: ReadonlyVec3,
    endPoint: ReadonlyVec3,
    slope?: number,
    length?: number
}

export interface StationSegmentDrawObject {
    segment: DrawPart;
    stations: DrawPart;
    labels?: DrawPart;
}

export interface StationsDrawObject {
    stationInfo: DrawPart;
    stationLines: DrawPart[];
}