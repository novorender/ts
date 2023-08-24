import type { ReadonlyVec3 } from "gl-matrix";


export interface CrossSection {
    readonly l: number,
    readonly p: ReadonlyVec3[]
}

export interface HeightMap {
    readonly name: string,
    readonly elevations: number[],
}

export interface CrossSections {
    readonly version: number,
    readonly name: string,
    readonly intervals: number[],
    readonly sections: CrossSection[],
    readonly labels: string[][],
    readonly codes: number[][],
    readonly centerLine: ReadonlyVec3[],
    readonly heightmaps: HeightMap[],
}