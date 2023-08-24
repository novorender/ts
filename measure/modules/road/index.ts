import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix"
export { RoadModule } from "./module";

/**
 * Cross section of a road
 */
export interface RoadCrossSection {
    /** 3d points between the different layers [ditch, should, road, center] */
    readonly points: ReadonlyVec3[],
    /** 
     * 2d points between the different layers [ditch, should, road, center] 
     * projected on a plane along the center line 
     */
    readonly points2D: ReadonlyVec2[],
    /** Layer names, this array matches the 3d and 2d points */
    readonly labels: string[],
    /** Slope from centerline to shoulder  [left, Right] */
    readonly slopes: {
        left: { slope: number, start: ReadonlyVec3, end: ReadonlyVec3 },
        right: { slope: number, start: ReadonlyVec3, end: ReadonlyVec3 }
    },
    /** Layer codes, this array matches the 3d and 2d points */
    readonly codes: number[]
}

/**
 * @ignore
 * In development
 */
export interface RoadProfile {
    name: string,
    elevations: number[]
}

/**
 * @ignore
 * In development
 */
export interface RoadProfiles {
    readonly name: string,
    readonly profiles: RoadProfile[],
    readonly intervals: number[]
}

/**
 * @ignore
 * In development
 */
export interface CrossSlope {
    readonly left: number[],
    readonly right: number[],
    readonly intervals: number[]
}