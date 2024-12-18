import type { Alignment, HorizonalPointOfCurvature, Profile, SlopeSegment, VerticalPointOfCurvature } from "measure";
import type { PointOfCurvature, ProductData } from "../brep";
import type { Curve3D, LineStrip3D, NurbsCurve3D } from "../curves";
import { matFromInstance } from "../loader";
import { reduceProfile, slopeFromProfile, topAndBottomFromProfile } from "../profile";
import { transformedLineData, reduceLineStrip } from "../util";
import { vec2, vec3, type ReadonlyMat4, type ReadonlyVec2, type ReadonlyVec3, type ReadonlyVec4 } from "gl-matrix";


function getVerticalPointsOfCurvature(verticalAlignment: ReadonlyVec2[], verticalPointsOfCurvature: readonly PointOfCurvature[]) {
    let alignmentIdx = 1;
    const pointsOfCurvature: VerticalPointOfCurvature[] = [];
    for (const point of verticalPointsOfCurvature) {
        for (; alignmentIdx < verticalAlignment.length; ++alignmentIdx) {
            const heightPoint = verticalAlignment[alignmentIdx];
            if (point.station < heightPoint[0]) {
                const prevHeightPoint = verticalAlignment[alignmentIdx - 1];
                const pointOfCurvature = vec2.lerp(vec2.create(), prevHeightPoint, heightPoint, point.station - prevHeightPoint[0]);
                pointsOfCurvature.push({ station: point.station, height: pointOfCurvature[1], parameter: point.parameter, kind: point.kind });
                break;
            }
        }
    }
    return pointsOfCurvature;
}

function getHorizontalPointsOfCurvature(curveSeg: Curve3D, horizontalPointsOfCurvature: readonly PointOfCurvature[], transform: ReadonlyMat4) {
    const curvaturePoints: HorizonalPointOfCurvature[] = [];
    let index = 0;
    for (const p of horizontalPointsOfCurvature) {

        const point = vec3.create();
        curveSeg.eval(p.station, point, undefined);
        for (; index < curveSeg.tesselationParameters.length; ++index) {
            if (p.station <= curveSeg.tesselationParameters[index]) {
                break;
            }
        }
        curveSeg.tesselationParameters
        vec3.transformMat4(point, point, transform);
        curvaturePoints.push({ station: p.station, point, index, kind: p.kind, parameter: p.parameter });
    }
    return curvaturePoints;
}

export function getAlignment(
    product: ProductData,
    curveSeg: Curve3D,
    instanceIdx: number,
    objectId: number,
    pointsOfCurvature?: { horizontal: readonly PointOfCurvature[], vertical: readonly PointOfCurvature[] }
): Alignment | undefined {
    let alignmentData: { line: ReadonlyVec3[], profile: ReadonlyVec2[] } | undefined;
    const transform = matFromInstance(product.instances[instanceIdx]);
    if (curveSeg && curveSeg.kind == "lineStrip") {
        const lineStrip = curveSeg as LineStrip3D;
        alignmentData = lineStrip.toTransformedLineData(transform);
    }
    else if (curveSeg && curveSeg.kind == "nurbs") {
        const nurbs = curveSeg as NurbsCurve3D;

        let parameters: readonly number[] = [];
        const vertices: ReadonlyVec3[] = [];
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

        alignmentData = transformedLineData(reduceLineStrip(vertices), parameters, transform);
    } else {
        return undefined;
    }
    const verticalAlignment = reduceProfile(alignmentData.profile);
    const stations: number[] = [];
    for (const p of alignmentData.profile) {
        stations.push(p[0]);
    }
    let verticalPointsOfCurvature: VerticalPointOfCurvature[] = [];
    let horizontalPointsOfCurvature: HorizonalPointOfCurvature[] = [];
    if (pointsOfCurvature) {
        verticalPointsOfCurvature = getVerticalPointsOfCurvature(alignmentData.profile, pointsOfCurvature.vertical);
        horizontalPointsOfCurvature = getHorizontalPointsOfCurvature(curveSeg, pointsOfCurvature.horizontal, transform);
    }
    return {
        objectId,
        points: alignmentData.line,
        stations,
        top: verticalAlignment.top,
        bottom: verticalAlignment.bottom,
        verticalPointsOfCurvature,
        horizontalPointsOfCurvature,
        verticalAlignment: verticalAlignment.profilePoints,
        tesselatedSegment: horizontalPointsOfCurvature.length == 0
    }

}