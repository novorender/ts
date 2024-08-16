import { vec2, vec3 } from "gl-matrix";
import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import type { ProductData } from "./brep";
import { cylinderCenterLine } from "./calculations";
import type { Curve3D, LineStrip3D, NurbsCurve3D } from "./curves";
import { crawlInstance, matFromInstance } from "./loader";
import { getProfile, reduceLineStrip } from "./util";
import type { MeasureSettings, Profile } from "measure";

export function slopeFromProfile(profile: ReadonlyVec2[]): number[] {
    const slopes: number[] = [];
    if (profile.length > 0) {
        for (let i = 1; i < profile.length; ++i) {
            const prevP = profile[i - 1];
            const p = profile[i];
            const segLen = p[0] - prevP[0];
            const heightDiff = p[1] - prevP[1];
            slopes.push(heightDiff / segLen);
        }
    }
    return slopes;
}

export function topAndBottomFromProfile(profile: ReadonlyVec2[]) {
    let top = Number.MIN_SAFE_INTEGER;
    let bottom = Number.MAX_SAFE_INTEGER;
    for (const v of profile) {
        top = Math.max(top, v[1]);
        bottom = Math.min(bottom, v[1]);
    }
    return { top, bottom };
}

export function reduceProfile(profile: ReadonlyVec2[]): Profile {
    const slopeEpsilon = 1e-4;
    const slopes: number[] = [];
    const newProfile: ReadonlyVec2[] = [];
    var elevations = topAndBottomFromProfile(profile);
    let startElevation = 0;
    let endElevation = 0;
    startElevation = profile[0][1];
    endElevation = profile[profile.length - 1][1];
    if (profile.length > 1) {
        let prevSlope = 0;
        newProfile.push(profile[0]);
        slopes.push(prevSlope);
        for (let i = 1; i < profile.length; ++i) {
            const prevP = profile[i - 1];
            const p = profile[i];
            const segLen = p[0] - prevP[0];
            const heightDiff = p[1] - prevP[1];
            const slope = heightDiff / segLen;
            if (Math.abs(slope - prevSlope) > slopeEpsilon) {
                slopes.push(prevSlope);
                newProfile.push(prevP);
            }
            prevSlope = slope;
        }
        newProfile.push(profile[profile.length - 1]);
        slopes.push(prevSlope);
    }
    return {
        profilePoints: newProfile,
        slopes,
        startElevation,
        endElevation,
        top: elevations.top,
        bottom: elevations.bottom,
    };
}

export function getCurveSegmentProfile(
    product: ProductData,
    curveSeg: Curve3D,
    instanceIdx: number
): Profile | undefined {
    if (curveSeg && curveSeg.kind == "lineStrip") {
        const lineStrip = curveSeg as LineStrip3D;
        const mat = matFromInstance(product.instances[instanceIdx]);
        const profile = lineStrip.toProfile(mat);
        return reduceProfile(profile);
    }
    if (curveSeg && curveSeg.kind == "nurbs") {
        const nurbs = curveSeg as NurbsCurve3D;

        const vertices: ReadonlyVec3[] = [];
        let parameters: readonly number[] = [];
        if (nurbs.order == 2) {
            for (let i = 1; i < nurbs.knots.length; ++i) {
                (parameters as number[]).push(nurbs.knots[i]);
            }
            vertices.push(...nurbs.controlPoints);
        } else {
            parameters = nurbs.tesselationParameters;
            for (const p of nurbs.tesselationParameters) {
                const v = vec3.create();
                nurbs.eval(p, v, undefined);
                vertices.push(v);
            }
        }

        const mat = matFromInstance(product.instances[instanceIdx]);
        const profile = getProfile(reduceLineStrip(vertices), parameters, mat);
        var elevations = topAndBottomFromProfile(profile);
        return {
            profilePoints: profile,
            slopes: slopeFromProfile(profile),
            startElevation: profile[0][1],
            endElevation: profile[profile.length - 1][1],
            top: elevations.top,
            bottom: elevations.bottom,
        };
    }
}

export async function getCylinderProfile(
    product: ProductData,
    faceIdx: number,
    instanceIdx: number,
    setting?: MeasureSettings
): Promise<Profile | undefined> {
    const face = product.faces[faceIdx];
    if (face.surface === undefined) {
        return;
    }
    const surfaceData = product.surfaces[face.surface];
    if (surfaceData.kind == "cylinder") {
        const mat = matFromInstance(product.instances[instanceIdx]);
        const [start, end] = await cylinderCenterLine(
            product,
            face,
            surfaceData,
            mat,
            setting ? setting.cylinderMeasure : "center"
        );
        const profile = [
            vec2.fromValues(0, start[2]),
            vec2.fromValues(
                vec2.distance(
                    vec2.fromValues(start[0], start[1]),
                    vec2.fromValues(end[0], end[1])
                ),
                end[2]
            ),
        ];
        var elevations = topAndBottomFromProfile(profile);

        return {
            profilePoints: profile,
            slopes: slopeFromProfile(profile),
            top: elevations.top,
            bottom: elevations.bottom,
            startElevation: profile[0][1],
            endElevation: profile[profile.length - 1][1],
        };
    }
}

export async function addCenterLinesFromCylinders(
    product: ProductData,
    centerLines: {
        start: ReadonlyVec3;
        end: ReadonlyVec3;
        radius: number;
        prev: number | undefined;
        next: number | undefined;
    }[],
    scale: number,
    setting?: MeasureSettings
) {
    const smallLines: {
        start: vec3;
        end: vec3;
        radius: number;
        checked: boolean
    }[] = [];

    const faceInstances = new Array<Array<number>>(product.instances.length);

    for (let i = 0; i < product.instances.length; ++i) {
        const instanceData = product.instances[i];
        const faces = new Array<number>();
        function faceFunc(faceIdx: number) {
            faces.push(faceIdx);
        }

        if (typeof instanceData.geometry == "number") {
            //check geom is number
            crawlInstance(product, instanceData, faceFunc, () => { });
        }
        faceInstances[i] = faces;
    }

    const cylinderMeasureSettings = setting ? setting.cylinderMeasure : "center";
    for (let i = 0; i < faceInstances.length; ++i) {
        const mat = matFromInstance(product.instances[i]);
        for (const faceIdx of faceInstances[i]) {
            const face = product.faces[faceIdx];
            if (face.surface === undefined) {
                continue;
            }
            const surfaceData = product.surfaces[face.surface];
            if (surfaceData.kind == "cylinder") {
                const [start, end] = await cylinderCenterLine(
                    product,
                    face,
                    surfaceData,
                    mat,
                    cylinderMeasureSettings
                );
                const scaledRadius = surfaceData.radius * scale;
                let add = true;
                const small = vec3.dist(start, end) < scaledRadius;

                for (let centerline of small ? smallLines : centerLines) {
                    const threshold = Math.abs(centerline.radius - scaledRadius) + 0.15;
                    if (
                        vec3.distance(start, centerline.start) < threshold &&
                        vec3.distance(end, centerline.end) < threshold
                    ) {
                        add = false;
                        if (cylinderMeasureSettings === "top") {
                            if (centerline.radius < scaledRadius) {
                                centerline.radius = scaledRadius;
                                centerline.start = start;
                                centerline.end = end;
                            }
                        } else if (centerline.radius > scaledRadius) {
                            centerline.radius = scaledRadius;
                            centerline.start = start;
                            centerline.end = end;
                        }
                        break;
                    }
                }
                if (add) {
                    if (small) {
                        smallLines.push({
                            start,
                            end,
                            radius: scaledRadius,
                            checked: false
                        });
                    }
                    else {
                        centerLines.push({
                            start,
                            end,
                            radius: scaledRadius,
                            next: undefined,
                            prev: undefined,
                        });
                    }
                }
            }
        }
    }
    for (let i = 0; i < smallLines.length; ++i) {
        const testLine = smallLines[i];
        let add = false;
        if (testLine.checked) {
            continue;
        }
        for (let j = i + 1; j < smallLines.length; ++j) {
            if (smallLines[j].checked) {
                continue;
            }
            const dist = vec3.dist(smallLines[j].start, testLine.end);
            const flippedDist = vec3.dist(smallLines[j].end, testLine.end);

            if (dist < testLine.radius && dist < flippedDist) {
                vec3.copy(testLine.end, smallLines[j].end);
                smallLines[j].checked = true;
                j = i + 1;
                add = true;
                continue;
            }
            if (flippedDist < testLine.radius) {
                vec3.copy(testLine.end, smallLines[j].start);
                smallLines[j].checked = true;
                j = i + 1;
                add = true;
                continue;
            }
        }
        if (add) {
            centerLines.push({
                start: testLine.start,
                end: testLine.end,
                radius: testLine.radius,
                next: undefined,
                prev: undefined,
            });
        }
    }
}

export function centerLinesToLinesTrip(
    centerLines: {
        start: ReadonlyVec3;
        end: ReadonlyVec3;
        radius: number;
        prev: number | undefined;
        next: number | undefined;
    }[]
) {
    if (centerLines.length == 1) {
        return [centerLines[0].start, centerLines[0].end];
    }
    const compare = (
        a: ReadonlyVec3,
        radiusA: number,
        b: ReadonlyVec3,
        radiusB: number
    ) => {
        const dist = vec3.distance(a, b);
        return dist < radiusA + radiusB;
    };

    let startSegment:
        | {
            start: ReadonlyVec3;
            end: ReadonlyVec3;
            prev: number | undefined;
            next: number | undefined;
        }
        | undefined = undefined;
    for (let i = 0; i < centerLines.length; ++i) {
        const currentSegment = centerLines[i];
        let findNext = currentSegment.next == undefined;
        let findPrev = currentSegment.prev == undefined;
        for (let j = i + 1; j < centerLines.length; ++j) {
            if (!findPrev && !findNext) {
                break;
            }
            const checkSegment = centerLines[j];
            if (
                findPrev &&
                compare(
                    currentSegment.start,
                    currentSegment.radius,
                    checkSegment.end,
                    checkSegment.radius
                )
            ) {
                checkSegment.next = i;
                currentSegment.prev = j;
                findPrev = false;
            }
            if (
                findNext &&
                compare(
                    currentSegment.end,
                    currentSegment.radius,
                    checkSegment.start,
                    checkSegment.radius
                )
            ) {
                checkSegment.prev = i;
                currentSegment.next = j;
                findNext = false;
            }
        }
        if (findNext && i != centerLines.length - 1) {
            for (let j = i + 1; j < centerLines.length; ++j) {
                const checkSegment = centerLines[j];
                if (
                    compare(
                        currentSegment.end,
                        currentSegment.radius,
                        checkSegment.end,
                        checkSegment.radius
                    )
                ) {
                    const tmp = checkSegment.start;
                    checkSegment.start = checkSegment.end;
                    checkSegment.end = tmp;
                    checkSegment.prev = i;
                    currentSegment.next = j;
                    break;
                }
            }
        }
        if (findPrev && i != centerLines.length - 1) {
            for (let j = i + 1; j < centerLines.length; ++j) {
                const checkSegment = centerLines[j];
                if (
                    compare(
                        currentSegment.start,
                        currentSegment.radius,
                        checkSegment.start,
                        checkSegment.radius
                    )
                ) {
                    const tmp = checkSegment.start;
                    checkSegment.start = checkSegment.end;
                    checkSegment.end = tmp;
                    checkSegment.next = i;
                    currentSegment.prev = j;
                    break;
                }
            }
        }
        if (findPrev) {
            if (currentSegment.next === undefined ||
                (startSegment != undefined && startSegment.prev === undefined)) {
                continue;
            }
            startSegment = currentSegment;
        }
    }
    const lineStrip: ReadonlyVec3[] = [];
    if (startSegment && startSegment.next === undefined) {
        lineStrip.push(vec3.clone(startSegment.start));
        lineStrip.push(vec3.clone(startSegment.end));
    } else if (startSegment && startSegment.next !== undefined) {
        let workingSegment = startSegment;
        lineStrip.push(vec3.clone(startSegment.start));
        lineStrip.push(vec3.clone(startSegment.end));
        let prevEnd = startSegment.end;
        while (workingSegment.next !== undefined) {
            workingSegment = centerLines[workingSegment.next];
            prevEnd = workingSegment.end;
            lineStrip.push(vec3.clone(workingSegment.end));
        }
    }
    return lineStrip;
}
