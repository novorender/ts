import { mat3, type ReadonlyVec3, vec2, vec3 } from "gl-matrix";
import { Downloader } from "../util";
import type { CrossSection, CrossSections } from "./cross_section";
import type { CrossSlope, RoadCrossSection, RoadProfile, RoadProfiles } from "measure";

export class RoadTool {
    data = new Map<string, CrossSections | null>();
    readonly downloader;
    constructor(readonly baseUrl: URL) {
        const crossUrl = baseUrl;
        crossUrl.pathname += "road/";
        this.downloader = new Downloader(crossUrl);
    }

    findShoulderIndex(codes: number[]) {
        let leftShoulder = 0;
        let rightShoulder = 0;
        let handleLeft = true;
        for (let i = 0; i < codes.length; ++i) {
            const code = codes[i];
            if (code == 10) {
                handleLeft = false;
            }
            if (code == 2) {
                if (handleLeft) {
                    leftShoulder = i;
                } else {
                    rightShoulder = i;
                    break;
                }
            }
        }
        return { leftShoulder, rightShoulder }
    }

    async downloadSections(name: string): Promise<CrossSections | null> {
        try {
            return await this.downloader.downloadJson(name);
        } catch {
            return null;
        }
    }

    private async getCrossSections(name: string): Promise<CrossSections | undefined> {
        if (this.data.size > 20) {
            this.data.clear();
        }
        let crossSection = this.data.get(name);
        if (crossSection === undefined) {
            crossSection = await this.downloadSections(`${name}.json`);
            this.data.set(name, crossSection);
        }
        return crossSection ?? undefined;
    }

    async getCrossSection(name: string, param: number): Promise<RoadCrossSection | undefined> {
        const crossSections = await this.getCrossSections(name);
        if (crossSections) {
            const { intervals, sections, labels, codes } = crossSections;

            let left: number = 0;
            let right: number = intervals.length - 1;

            const sectionFromIndex = (index: number) => {
                if (index !== 0 && labels[sections[index - 1].l].length === 1) {
                    return undefined
                }

                let pts: ReadonlyVec3[];
                let centerDir: vec3;
                const sec = sections[index];
                const centerIdx = crossSections.codes[sec.l].findIndex((c) => c == 10);
                const currCenter = sec.p[centerIdx];
                if (index == 0) {
                    pts = sec.p;
                    const nextSec = sections[index + 1];
                    const nextCenterIdx = nextSec.l == sec.l ? centerIdx : crossSections.codes[nextSec.l].findIndex((c) => c == 10);
                    const nextCenter = nextSec.p[nextCenterIdx];
                    centerDir = vec3.sub(vec3.create(), nextCenter, currCenter);
                    vec3.normalize(centerDir, centerDir);
                } else {
                    let prevCenter: ReadonlyVec3 = vec3.create();
                    let prevSec: CrossSection;
                    let prevIdx = 0;
                    do {
                        ++prevIdx;
                        prevSec = sections[index - prevIdx];
                        const nextCenterIdx = prevSec.l == sec.l ? centerIdx : crossSections.codes[prevSec.l].findIndex((c) => c == 10);
                        prevCenter = prevSec.p[nextCenterIdx];
                    } while (vec3.exactEquals(currCenter, prevCenter) && index - prevIdx > 0);

                    const internalParam = Math.abs(param - intervals[index - prevIdx]);
                    if (internalParam > 10) {
                        return undefined;
                    }

                    if (vec3.exactEquals(currCenter, prevCenter)) {
                        return undefined;
                    }

                    centerDir = vec3.sub(vec3.create(), currCenter, prevCenter);
                    vec3.normalize(centerDir, centerDir);
                    pts = prevSec.l == sec.l ? prevSec.p.map((p, i) => {
                        const nextP = sec.p[i];
                        const dir = vec3.sub(vec3.create(), nextP, p);
                        vec3.normalize(dir, dir);
                        return vec3.scaleAndAdd(vec3.create(), p, dir, internalParam);
                    }) : sec.p;
                }
                const up = vec3.fromValues(0, 0, 1);
                const right = vec3.cross(vec3.create(), up, centerDir);
                vec3.normalize(right, right);
                vec3.cross(centerDir, right, up);
                vec3.normalize(centerDir, centerDir);
                const mat = mat3.fromValues(
                    right[0], right[1], right[2],
                    up[0], up[1], up[2],
                    centerDir[0], centerDir[1], centerDir[2]
                );

                const points2D = pts.map((p) => {
                    const _p = vec3.transformMat3(vec3.create(), p, mat);
                    return vec2.fromValues(_p[0], _p[1]);
                });

                const points = pts.map((p) => {
                    return vec3.scaleAndAdd(vec3.create(), p, centerDir, 0.001);
                });

                const sectionCodes = codes[sec.l];

                const { leftShoulder, rightShoulder } = this.findShoulderIndex(sectionCodes)
                const cp = vec3.clone(points[centerIdx]);
                const lp = vec3.clone(points[leftShoulder]);
                const rp = vec3.clone(points[rightShoulder]);

                const cp2d = vec2.fromValues(cp[0], cp[1]);
                const lp2d = vec2.fromValues(lp[0], lp[1]);
                const rp2d = vec2.fromValues(rp[0], rp[1]);
                const slopeL = Math.abs(cp[2] - lp[2]) / vec2.dist(cp2d, lp2d);
                const slopeR = Math.abs(cp[2] - rp[2]) / vec2.dist(cp2d, rp2d);

                const slopes = {
                    left: { slope: slopeL, start: lp, end: cp },
                    right: { slope: slopeR, start: cp, end: rp }
                };

                return { points, labels: labels[sec.l], points2D, slopes, codes: sectionCodes };
            }

            while (left <= right) {
                const mid: number = Math.floor((left + right) / 2);
                const midParam = intervals[mid];
                if (mid === intervals.length - 1) {
                    if (midParam < param) {
                        return sectionFromIndex(mid);
                    }
                    return undefined;
                }
                if (Math.abs(midParam - param) < 0.001) {
                    return sectionFromIndex(mid);
                }
                if (param < midParam) {
                    right = mid - 1;
                }
                else {
                    const nextParam = intervals[mid + 1];
                    if (param < nextParam) {
                        return sectionFromIndex(mid + 1);
                    }
                    left = mid + 1;
                }

            }
        }
    }

    async getRoadProfiles(name: string): Promise<RoadProfiles | undefined> {
        const crossSections = await this.getCrossSections(name);
        if (crossSections) {
            if (crossSections.heightmaps.length != 0) {
                const profiles: RoadProfile[] = [];
                profiles.push({ name: crossSections.name, elevations: crossSections.centerLine.map(p => p[2]) });
                for (const map of crossSections.heightmaps) {
                    profiles.push(map);
                }
            }
        }
        return undefined;
    }

    async getCrossSlope(name: string): Promise<CrossSlope | undefined> {
        const crossSections = await this.getCrossSections(name);
        if (crossSections) {
            const left: number[] = [];
            const right: number[] = [];
            crossSections.sections.forEach(section => {
                const sectionCodes = crossSections.codes[section.l];
                const { leftShoulder, rightShoulder } = this.findShoulderIndex(sectionCodes);
                const centerIdx = sectionCodes.findIndex((c) => c == 10);
                const cp = vec3.clone(section.p[centerIdx]);
                const lp = vec3.clone(section.p[leftShoulder]);
                const rp = vec3.clone(section.p[rightShoulder]);

                const cp2d = vec2.fromValues(cp[0], cp[1]);
                const lp2d = vec2.fromValues(lp[0], lp[1]);
                const rp2d = vec2.fromValues(rp[0], rp[1]);
                left.push(cp[2] - lp[2] / vec2.dist(cp2d, lp2d));
                right.push(cp[2] - rp[2] / vec2.dist(cp2d, rp2d));
            });
            return { intervals: crossSections.intervals, left, right };
        }
        return undefined;
    }

    // async getRoadProfiles(name: string): Promise<RoadProfiles | undefined> {
    //     const crossSections = await this.getCrossSections(name);
    //     if (crossSections) {

    //         const profiles: RoadProfile[] = [];

    //         const addOrAppend = (codes: number[], points: ReadonlyVec2[][], labels: string[]) => {
    //             for (let i = 0; i < codes.length; ++i) {
    //                 const side = codes[i] == 10 ? "center" : labels[i][0] === '-' ? "left" : "right";
    //                 const p = profiles.find((p) => p.code == codes[i] && p.side == side && p.label == labels[i]);
    //                 if (p) {
    //                     p.points.push(...points[i]);
    //                 } else {
    //                     profiles.push({ code: codes[i], label: labels[i], points: points[i], side });
    //                 }
    //             }
    //         }

    //         let currentCodes = crossSections.codes[0];
    //         let currentLabels = crossSections.labels[0];
    //         let currentPoints: ReadonlyVec2[][] = [];
    //         let currentLabelsIdx = 0;
    //         for (let i = 0; i < crossSections.intervals.length; ++i) {
    //             const section = crossSections.sections[i];
    //             if (currentLabelsIdx != section.l) {
    //                 addOrAppend(currentCodes, currentPoints, currentLabels);
    //                 currentCodes = crossSections.codes[section.l];
    //                 currentLabels = crossSections.labels[section.l];
    //                 currentLabelsIdx = section.l
    //                 currentPoints = [];
    //             }
    //             if (currentPoints.length == 0) {
    //                 for (let j = 0; j < section.p.length; ++j) {
    //                     currentPoints.push([]);
    //                 }
    //             }
    //             const currentParam = crossSections.intervals[i];
    //             for (let j = 0; j < section.p.length; ++j) {
    //                 currentPoints[j].push(vec2.fromValues(currentParam, section.p[j][2]));
    //             }
    //         }
    //         addOrAppend(currentCodes, currentPoints, currentLabels);
    //         return { name: crossSections.centerLine, profiles };
    //     }
    // }
}