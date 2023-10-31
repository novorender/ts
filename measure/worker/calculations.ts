import type { ReadonlyMat4, ReadonlyVec3 } from "gl-matrix";
import { glMatrix, mat3, mat4, vec2, vec3 } from "gl-matrix";
import type { AABB3, CylinderData, EdgeData, FaceData, ProductData } from "./brep";
import type { Curve3D, LineSegment3D } from "./curves";
import { Arc3D, Line3D, LineStrip3D, lineToSegment, pointAtAngle } from "./curves";
import { matFromInstance } from "./loader";
import type { Plane } from "./surfaces";
import { closestPointToLine } from "./util";
import { unitToScale } from "./loader";
import type { CylinerMeasureType, DuoMeasurementValues, MeasureSettings } from "measure";
import { MeasureTool } from "./scene";


glMatrix.setMatrixArrayType(Array);

const epsilon = 0.0001;

export function isInsideAABB(point: vec3, aabb: AABB3, epsilon = 0): boolean {
  for (let i = 0; i < 3; ++i) {
    if (
      point[i] - aabb.min[i] + epsilon < 0 ||
      aabb.max[i] - point[i] + epsilon < 0
    ) {
      return false;
    }
  }
  return true;
}

export function cylinderLength(
  product: ProductData,
  cylinderFace: FaceData,
  origo: vec3,
  dir: vec3
): number {
  const loopData = product.loops[cylinderFace.outerLoop];
  //const halfEdges = loopData.halfEdges.map((i) => product.halfEdges[i]);
  // //First try with seam
  // for (const halfEdge of halfEdges) {
  //     const edge = product.edges[halfEdge.edge];
  //     if (edge.virtual) {
  //         return (edge.parameterBounds[1] - edge.parameterBounds[0]) * halfEdge.direction;
  //     }
  // }
  const circleOrigins: ReadonlyVec3[] = [];
  for (const halfEdge of loopData.halfEdges) {
    const halfEdgeData = product.halfEdges[halfEdge];
    const edgeData = product.edges[halfEdgeData.edge];
    if (edgeData.curve3D !== undefined) {
      const curveData = product.curves3D[edgeData.curve3D];
      if (curveData.kind == "circle") {
        circleOrigins.push(curveData.origin);
      }
    }
  }
  if (circleOrigins.length == 2) {
    let sense = 1;
    const other = vec3.equals(circleOrigins[0], origo)
      ? circleOrigins[1]
      : circleOrigins[0];
    if (vec3.dot(dir, vec3.sub(vec3.create(), other, origo)) < 0) {
      sense = -1;
    }
    return sense * vec3.dist(circleOrigins[0], circleOrigins[1]);
  }
  return 0;
}

function fullCircle(edge: EdgeData): boolean {
  const paramLength = Math.abs(
    edge.parameterBounds[1] - edge.parameterBounds[0]
  );
  return Math.abs(paramLength - 2 * Math.PI) < epsilon;
}

export function fullCircleCylinder(
  product: ProductData,
  cylinderFace: FaceData
): boolean {
  const loopData = product.loops[cylinderFace.outerLoop];
  const halfEdges = loopData.halfEdges.map((i) => product.halfEdges[i]);
  let noArcs = 0;
  for (const halfEdge of halfEdges) {
    const edge = product.edges[halfEdge.edge];
    if (edge.curve3D !== undefined) {
      const curve = product.curves3D[edge.curve3D];
      if (curve.kind == "circle") {
        noArcs++;
        if (!fullCircle(edge)) {
          return false;
        }
      }
    }
  }
  return noArcs == 2;
}

export async function cylinderCenterLine(
  product: ProductData,
  cylinderFace: FaceData,
  cylinderData: CylinderData,
  instanceMat: ReadonlyMat4,
  measureType?: CylinerMeasureType
): Promise<[vec3, vec3]> {
  const scale = unitToScale(product.units);
  const cylinderMtx = mat4.fromValues(
    ...(cylinderData.transform as Parameters<typeof mat4.fromValues>)
  );
  const cylinderOrigo = mat4.getTranslation(vec3.create(), cylinderMtx);
  const cylinderDir = vec3.fromValues(
    cylinderMtx[8],
    cylinderMtx[9],
    cylinderMtx[10]
  );
  const cyliderLen = cylinderLength(
    product,
    cylinderFace,
    cylinderOrigo,
    cylinderDir
  );
  const cylinderEnd = vec3.add(
    vec3.create(),
    cylinderOrigo,
    vec3.scale(vec3.create(), cylinderDir, cyliderLen)
  );
  vec3.transformMat4(cylinderOrigo, cylinderOrigo, instanceMat);
  vec3.transformMat4(cylinderEnd, cylinderEnd, instanceMat);

  if (measureType == "bottom" || measureType == "top") {
    //top or bottom
    const dir = vec3.sub(vec3.create(), cylinderEnd, cylinderOrigo);
    vec3.normalize(dir, dir);
    const up = glMatrix.equals(
      Math.abs(vec3.dot(vec3.fromValues(0, 0, 1), dir)),
      1
    )
      ? vec3.fromValues(0, 1, 0)
      : vec3.fromValues(0, 0, 1);

    const right = vec3.cross(vec3.create(), up, dir);
    vec3.cross(up, dir, right);
    vec3.normalize(up, up);
    if (measureType == "top") {
      vec3.scaleAndAdd(cylinderOrigo, cylinderOrigo, up, cylinderData.radius * scale);
      vec3.scaleAndAdd(cylinderEnd, cylinderEnd, up, cylinderData.radius * scale);
    } else {
      vec3.scaleAndAdd(cylinderOrigo, cylinderOrigo, up, -cylinderData.radius * scale);
      vec3.scaleAndAdd(cylinderEnd, cylinderEnd, up, -cylinderData.radius * scale);
    }
  }

  return [cylinderOrigo, cylinderEnd];
}

export function closestPointsToIntersection(
  startA: ReadonlyVec3,
  endA: ReadonlyVec3,
  startB: ReadonlyVec3,
  endB: ReadonlyVec3
): vec3 {
  const dirA = vec3.sub(vec3.create(), endA, startA);
  const lenA = vec3.len(dirA);
  vec3.normalize(dirA, dirA);
  const dirB = vec3.sub(vec3.create(), endB, startB);
  vec3.normalize(dirB, dirB);
  const dp = vec3.dot(dirA, dirB);
  const cp = vec3.len(vec3.cross(vec3.create(), dirA, dirB));

  function intersectionPoint(
    a: ReadonlyVec3,
    da: ReadonlyVec3,
    p: ReadonlyVec3,
    l: number
  ): vec3 {
    const ab = vec3.sub(vec3.create(), p, a);
    const ta = vec3.dot(ab, da);
    const pa = vec3.scaleAndAdd(vec3.create(), a, da, ta);
    const d = vec3.dist(pa, p);
    const tb = (d * dp) / cp;
    const t = Math.min(l, Math.max(ta + tb, 0));
    return vec3.scaleAndAdd(vec3.create(), a, da, t);
  }

  return intersectionPoint(startA, dirA, startB, lenA);
}

export function closestProjectedPoints(
  startA: ReadonlyVec3,
  endA: ReadonlyVec3,
  startB: ReadonlyVec3,
  endB: ReadonlyVec3
): [number, vec3, vec3] {
  let pointA = vec3.create();
  let pointB = vec3.create();

  const { pos: p1 } = closestPointToLine(startB, startA, endA);
  const { pos: p2 } = closestPointToLine(endB, startA, endA);
  const { pos: p3 } = closestPointToLine(startA, startB, endB);
  const { pos: p4 } = closestPointToLine(endA, startB, endB);

  const d1 = vec3.length(vec3.sub(vec3.create(), startB, p1));
  const d2 = vec3.length(vec3.sub(vec3.create(), p2, endB));
  const d3 = vec3.length(vec3.sub(vec3.create(), startA, p3));
  const d4 = vec3.length(vec3.sub(vec3.create(), p4, endA));

  let pointChosen: "a" | "b" = "a";
  let distance = 0;
  if (d1 < d2 && d1 < d3 && d1 < d4) {
    distance = d1;
    pointA = p1;
    pointB = startB as vec3;
  } else if (d2 < d3 && d2 < d4) {
    distance = d2;
    pointA = p2;
    pointB = endB as vec3;
  } else if (d3 < d4) {
    distance = d3;
    pointA = startA as vec3;
    pointB = p3;
    pointChosen = "b"
  } else {
    distance = d3;
    pointA = endA as vec3;
    pointB = p4;
    pointChosen = "b"
  }
  if (pointChosen == "a") {
    const { pos: p5 } = closestPointToLine(pointA, startB, endB);
    const testDist = vec3.dist(p5, pointA);
    if (testDist < distance) {
      pointB = p5;
      distance = testDist;
    }
  } else {
    const { pos: p5 } = closestPointToLine(pointB, startA, endA);
    const testDist = vec3.dist(p5, pointB);
    if (testDist < distance) {
      pointA = p5;
      distance = testDist;
    }
  }

  return [distance, pointA, pointB];
}

export function decomposePlane(
  product: ProductData,
  faceData: FaceData,
  instanceIdx: number,
  plane: Plane,
  centerPoint = false
): [vec3, vec3] {
  const mat = matFromInstance(product.instances[instanceIdx]);
  const normalMat = mat3.normalFromMat4(mat3.create(), mat);

  const uv = vec2.fromValues(0, 0);
  const planePoint = vec3.create();
  const planeNorm = vec3.create();
  if (centerPoint) {
    vec3.add(planePoint, faceData.aabb.max, faceData.aabb.min);
    vec3.scale(planePoint, planePoint, 0.5);
  } else {
    plane.evalPosition(planePoint, uv);
  }
  plane.evalNormal(planeNorm, uv);
  vec3.transformMat4(planePoint, planePoint, mat);
  vec3.transformMat3(planeNorm, planeNorm, normalMat);
  vec3.normalize(planeNorm, planeNorm);
  return [planePoint, planeNorm];
}

function lineToLineMeasure(segA: LineSegment3D, segB: LineSegment3D): DuoMeasurementValues {
  const parallel =
    vec3.equals(segA.dir, segB.dir) ||
    vec3.equals(segA.dir, vec3.negate(segB.dir, segB.dir));

  let [distance, pointA, pointB] = closestProjectedPoints(
    segA.start,
    segA.end,
    segB.start,
    segB.end
  );
  const diff = vec3.sub(vec3.create(), pointA, pointB);
  if (!parallel) {
    const crossPoint = closestPointsToIntersection(
      segA.start,
      segA.end,
      segB.start,
      segB.end
    );
    const { pos: crossPointA } = closestPointToLine(
      crossPoint,
      segA.start,
      segA.end
    );
    const { pos: crossPointB } = closestPointToLine(
      crossPoint,
      segB.start,
      segB.end
    );
    if (distance > vec3.dist(crossPointA, crossPointB)) {
      pointA = crossPointA;
      pointB = crossPointB;
      vec3.sub(diff, crossPointB, crossPointA);
    }
  }

  return {
    drawKind: "measureResult",
    distance: vec3.len(diff),
    distanceX: Math.abs(diff[0]),
    distanceY: Math.abs(diff[1]),
    distanceZ: Math.abs(diff[2]),
    measureInfoA: { point: pointA },
    measureInfoB: { point: pointB }
  };
}

function toMeasureValues(pointA: vec3, pointB: vec3, parameterA?: number, parameterB?: number): DuoMeasurementValues {
  const diff = vec3.subtract(vec3.create(), pointA, pointB);
  return {
    drawKind: "measureResult",
    distance: vec3.len(diff),
    distanceX: Math.abs(diff[0]),
    distanceY: Math.abs(diff[1]),
    distanceZ: Math.abs(diff[2]),
    measureInfoA: { point: pointA, parameter: parameterA },
    measureInfoB: { point: pointB, parameter: parameterB }
  };
}

function segmentToArcMeasure(
  arc: Arc3D,
  arcMat: ReadonlyMat4,
  seg: LineSegment3D
): DuoMeasurementValues {
  const wsOrigin = vec3.transformMat4(vec3.create(), arc.origin, arcMat);
  const { pos: point } = closestPointToLine(wsOrigin, seg.start, seg.end);
  const arcInvMat = mat4.invert(mat4.create(), arcMat);
  const pointInArcSpace = vec3.transformMat4(vec3.create(), point, arcInvMat);

  const t = pointAtAngle(pointInArcSpace, arc);
  const pointA = vec3.create();
  const pointB = vec3.create();
  if (t <= arc.endParam && t >= arc.beginParam) {
    arc.eval(t, pointA, undefined);
    vec3.transformMat4(pointA, pointA, arcMat);
    vec3.copy(pointB, point);
  } else {
    const arcPointA = vec3.create();
    arc.eval(arc.beginParam, arcPointA, undefined);
    vec3.transformMat4(arcPointA, arcPointA, arcMat);
    const arcPointB = vec3.create();
    arc.eval(arc.endParam, arcPointB, undefined);
    vec3.transformMat4(arcPointB, arcPointB, arcMat);
    const { pos: linePointA } = closestPointToLine(
      arcPointA,
      seg.start,
      seg.end
    );
    const { pos: linePointB } = closestPointToLine(
      arcPointB,
      seg.start,
      seg.end
    );

    const da = vec3.dist(linePointA, arcPointA);
    const db = vec3.dist(linePointB, arcPointB);
    if (da < db) {
      vec3.copy(pointA, arcPointA);
      vec3.copy(pointB, linePointA);
    } else {
      vec3.copy(pointA, arcPointB);
      vec3.copy(pointB, linePointB);
    }
  }
  return toMeasureValues(pointA, pointB);
}

function closestPointToArc(point: ReadonlyVec3, arc: Arc3D, mat: ReadonlyMat4) {
  const invMat = mat4.invert(mat4.create(), mat);
  const localSpaceP = vec3.transformMat4(vec3.create(), point, invMat);
  const t = arc.invert(localSpaceP);
  const pointOnCircle = vec3.create();
  arc.eval(t, pointOnCircle, undefined);
  vec3.transformMat4(pointOnCircle, pointOnCircle, mat);
  return pointOnCircle;
}

function getCurveToCurveMeasureValues(
  productA: ProductData,
  curveA: Curve3D,
  instanceIdxA: number,
  productB: ProductData,
  curveB: Curve3D,
  instanceIdxB: number
): DuoMeasurementValues | undefined {
  let curveDataA = { prouct: productA, curve: curveA, instance: instanceIdxA };
  let curveDataB = { prouct: productB, curve: curveB, instance: instanceIdxB };
  const entities = [curveDataA, curveDataB];
  entities.sort((a, b) => a.curve!.kind.localeCompare(b.curve!.kind));
  [curveDataA, curveDataB] = entities;
  const kindCombo = `${curveDataA.curve!.kind}_${curveDataB.curve!.kind}`;
  const matA = matFromInstance(
    curveDataA.prouct.instances[curveDataA.instance]
  );
  const matB = matFromInstance(
    curveDataB.prouct.instances[curveDataB.instance]
  );
  switch (kindCombo) {
    case "line_line": {
      const values = lineToLineMeasure(
        lineToSegment(curveDataA.curve as Line3D, matA),
        lineToSegment(curveDataB.curve as Line3D, matB)
      );
      return values;
    }
    case "arc_arc": {
      const arcA = curveDataA.curve as Arc3D;
      const arcB = curveDataB.curve as Arc3D;
      const wsOriginA = vec3.transformMat4(vec3.create(), arcA.origin, matA);
      const wsOriginB = vec3.transformMat4(vec3.create(), arcB.origin, matB);
      const closestPointA = closestPointToArc(wsOriginA, arcB, matB);
      const closestPointB = closestPointToArc(wsOriginB, arcA, matA);
      return toMeasureValues(closestPointA, closestPointB);
    }
    case "arc_line": {
      const arc = curveDataA.curve as Arc3D;
      const line = curveDataB.curve as Line3D;
      return segmentToArcMeasure(arc, matA, lineToSegment(line, matA));
    }
    case "arc_lineStrip": {
      const arc = curveDataA.curve as Arc3D;
      const strip = curveDataB.curve as LineStrip3D;
      const segments = strip.toSegments(matB);
      let minDist = 1000000;
      let bestMeasureValues: undefined | DuoMeasurementValues = undefined;
      for (const seg of segments) {
        const measureValue = segmentToArcMeasure(arc, matA, seg);
        if (measureValue.distance && measureValue.distance < minDist) {
          bestMeasureValues = measureValue;
          minDist = measureValue.distance;
        }
      }
      return bestMeasureValues;
    }
    case "line_lineStrip": {
      const segmentA = lineToSegment(curveDataA.curve as Line3D, matA);
      const strip = curveDataB.curve as LineStrip3D;
      const segments = strip.toSegments(matB);
      let minDist = 1000000;
      let bestMeasureValues: undefined | DuoMeasurementValues = undefined;
      for (const seg of segments) {
        const measureValue = lineToLineMeasure(segmentA, seg);
        if (measureValue.distance && measureValue.distance < minDist) {
          bestMeasureValues = measureValue;
          minDist = measureValue.distance;
        }
      }
      if (
        bestMeasureValues &&
        bestMeasureValues.measureInfoA?.point &&
        bestMeasureValues.measureInfoB?.point
      ) {
        const tb = strip.invert(bestMeasureValues.measureInfoB.point);
        return { ...bestMeasureValues, measureInfoB: { point: bestMeasureValues.measureInfoB.point, parameter: tb } };
      }
    }
    case "lineStrip_lineStrip": {
      const stripA = curveDataA.curve as LineStrip3D;
      const segmentsA = stripA.toSegments(matA);

      const stripB = curveDataB.curve as LineStrip3D;
      const segmentsB = stripB.toSegments(matB);
      let minDist = 1000000;
      let bestMeasureValues: undefined | DuoMeasurementValues = undefined;
      for (const segA of segmentsA) {
        for (const segB of segmentsB) {
          const measureValue = lineToLineMeasure(segA, segB);
          if (measureValue.distance && measureValue.distance < minDist) {
            bestMeasureValues = measureValue;
            minDist = measureValue.distance;
          }
        }
      }
      if (
        bestMeasureValues &&
        bestMeasureValues.measureInfoA?.point &&
        bestMeasureValues.measureInfoB?.point
      ) {
        const ta = stripA.invert(bestMeasureValues.measureInfoA.point);
        const tb = stripB.invert(bestMeasureValues.measureInfoB.point);
        return { ...bestMeasureValues, measureInfoA: { point: bestMeasureValues.measureInfoA.point, parameter: ta }, measureInfoB: { point: bestMeasureValues.measureInfoB.point, parameter: tb } };
      }
      return bestMeasureValues;
    }
  }
}

export async function getEdgeToEdgeMeasureValues(
  productA: ProductData,
  edgeIdxA: number,
  instanceIdxA: number,
  productB: ProductData,
  edgeIdxB: number,
  instanceIdxB: number
): Promise<DuoMeasurementValues | undefined> {
  let edgeCurveA = MeasureTool.geometryFactory.getCurve3DFromEdge(
    productA,
    edgeIdxA
  );
  let edgeCurveB = MeasureTool.geometryFactory.getCurve3DFromEdge(
    productB,
    edgeIdxB
  );
  if (edgeCurveA && edgeCurveB) {
    return getCurveToCurveMeasureValues(
      productA,
      edgeCurveA,
      instanceIdxA,
      productB,
      edgeCurveB,
      instanceIdxB
    );
  }
}

export async function faceToPointMeasureValues(
  product: ProductData,
  faceIdx: number,
  instanceIdx: number,
  point: vec3,
  scale: number,
  setting?: MeasureSettings
): Promise<DuoMeasurementValues | undefined> {
  const faceData = product.faces[faceIdx];
  const surfaceData = product.surfaces[faceData.surface];
  const surface = MeasureTool.geometryFactory.getSurface(surfaceData, 1);
  if (surface) {
    const mat = matFromInstance(product.instances[instanceIdx]);

    switch (surface.kind) {
      case "plane": {
        const [pointPlane, norm] = decomposePlane(
          product,
          faceData,
          instanceIdx,
          surface as Plane,
          false
        );

        const d = vec3.dot(
          norm,
          vec3.subtract(vec3.create(), point, pointPlane)
        );
        const normalPoint = vec3.add(
          vec3.create(),
          point,
          vec3.scale(vec3.create(), vec3.negate(vec3.create(), norm), d)
        );

        return {
          drawKind: "measureResult",
          normalDistance: Math.abs(d),
          distanceX: 0,
          distanceY: 0,
          distanceZ: 0,
          normalPoints: [point, normalPoint],
        };
      }
      case "cylinder": {
        const cylinderMeasure = setting ? setting.cylinderMeasure : "center";
        const cylinder = surfaceData as CylinderData;
        const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
          product,
          faceData,
          cylinder,
          mat,
          cylinderMeasure
        );

        const projectedPoint = vec3.create();
        const { pos: p1 } = closestPointToLine(
          point,
          cylinderOrigo,
          cylinderEnd,
          projectedPoint
        );
        const diff = vec3.sub(vec3.create(), point, p1);
        const canUseCylinderSettings =
          vec3.equals(projectedPoint, p1) &&
          fullCircleCylinder(product, faceData);

        if (
          (cylinderMeasure == "closest" || cylinderMeasure == "furthest") &&
          canUseCylinderSettings
        ) {
          vec3.normalize(diff, diff);
          vec3.scale(diff, diff, cylinder.radius * scale);
          if (cylinderMeasure == "closest") {
            vec3.add(p1, p1, diff);
          } else {
            vec3.sub(p1, p1, diff);
          }
          vec3.sub(diff, point, p1);
        }

        return {
          drawKind: "measureResult",
          distance: vec3.length(diff),
          distanceX: Math.abs(diff[0]),
          distanceY: Math.abs(diff[1]),
          distanceZ: Math.abs(diff[2]),
          measureInfoA: { point, validMeasureSettings: canUseCylinderSettings },
          measureInfoB: { point: p1, validMeasureSettings: canUseCylinderSettings }
        };
      }
    }
  }
}

function curveToPointMeasureValues(
  product: ProductData,
  curve: Curve3D,
  instanceIdx: number,
  point: vec3
): DuoMeasurementValues | undefined {
  const mat = matFromInstance(product.instances[instanceIdx]);
  if (curve.kind == "line") {
    const line = curve as Line3D;
    const start = vec3.create();
    const end = vec3.create();
    const dir = vec3.create();
    curve.eval(line.beginParam, start, dir);
    curve.eval(line.endParam, end, undefined);
    vec3.transformMat4(start, start, mat);
    vec3.transformMat4(end, end, mat);
    const projectedPoint = vec3.create();
    const { pos: closestPointOnLine } = closestPointToLine(
      point,
      start,
      end,
      projectedPoint
    );
    return toMeasureValues(point, closestPointOnLine);
  } else if (curve.kind == "arc") {
    const closestPoint = closestPointToArc(point, curve as Arc3D, mat);
    return toMeasureValues(point, closestPoint);
  } else if (curve.kind == "lineStrip") {
    const invMat = mat4.invert(mat4.create(), mat);
    const localSpaceP = vec3.transformMat4(vec3.create(), point, invMat);
    const t = curve.invert(localSpaceP);
    const closestPoint = vec3.create();
    curve.eval(t, closestPoint, undefined);
    vec3.transformMat4(closestPoint, closestPoint, mat);
    return toMeasureValues(point, closestPoint, undefined, t);
  }
}

export async function edgeToPointMeasureValues(
  product: ProductData,
  edgeIdx: number,
  instanceIdx: number,
  point: vec3
): Promise<DuoMeasurementValues | undefined> {
  const curve = MeasureTool.geometryFactory.getCurve3DFromEdge(product, edgeIdx);
  if (curve) {
    return curveToPointMeasureValues(product, curve, instanceIdx, point);
  }
}

export async function segmentToPointMeasureValues(
  product: ProductData,
  segIdx: number,
  instanceIdx: number,
  point: vec3
): Promise<DuoMeasurementValues | undefined> {
  const curve = MeasureTool.geometryFactory.getCurve3DFromSegment(product, segIdx);
  if (curve) {
    return curveToPointMeasureValues(product, curve, instanceIdx, point);
  }
}

function lineToPlaneMeasure(
  lineSegment: LineSegment3D,
  plane: Plane,
  planeProduct: ProductData,
  planeFacedata: FaceData,
  faceInstance: number
): DuoMeasurementValues | undefined {
  const [planePoint, planeNorm] = decomposePlane(
    planeProduct,
    planeFacedata,
    faceInstance,
    plane
  );
  const lineLength = vec3.dist(lineSegment.start, lineSegment.end);
  const linePoint = vec3.scaleAndAdd(
    vec3.create(),
    lineSegment.start,
    lineSegment.dir,
    lineLength
  );
  const parallel = Math.abs(vec3.dot(lineSegment.dir, planeNorm)) < 0.001;
  if (parallel) {
    const d1 = vec3.dot(planeNorm, planePoint);
    const d2 = vec3.dot(planeNorm, linePoint);
    const d = d1 - d2;
    const normalPointFromLine = vec3.add(
      vec3.create(),
      linePoint,
      vec3.scale(vec3.create(), planeNorm, d)
    );

    return {
      drawKind: "measureResult",
      distance: Math.abs(d),
      distanceX: 0,
      distanceY: 0,
      distanceZ: 0,
      normalPoints: [normalPointFromLine, linePoint]
    };
  }
}

async function lineToCylinderMeasure(
  seg: LineSegment3D,
  cylinder: CylinderData,
  cylinderProduct: ProductData,
  cylinderFaceData: FaceData,
  cylinderMat: mat4,
  cylinderScale: number,
  cylinderMeasure: CylinerMeasureType
): Promise<DuoMeasurementValues> {
  const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
    cylinderProduct,
    cylinderFaceData,
    cylinder,
    cylinderMat,
    cylinderMeasure
  );
  const cylinderDir = vec3.sub(vec3.create(), cylinderEnd, cylinderOrigo);
  vec3.normalize(cylinderDir, cylinderDir);
  const parallel =
    vec3.equals(cylinderDir, seg.dir) ||
    vec3.equals(cylinderDir, vec3.negate(vec3.create(), seg.dir));

  const [distance, pointA, pointB] = closestProjectedPoints(
    cylinderOrigo,
    cylinderEnd,
    seg.start,
    seg.end
  );
  if (!parallel) {
    const crossPoint = closestPointsToIntersection(
      cylinderOrigo,
      cylinderEnd,
      seg.start,
      seg.end
    );
    const { pos: crossPointA } = closestPointToLine(
      crossPoint,
      cylinderOrigo,
      cylinderEnd
    );
    const { pos: crossPointB } = closestPointToLine(
      crossPoint,
      seg.start,
      seg.end
    );
    if (distance > vec3.dist(crossPointA, crossPointB)) {
      vec3.copy(pointA, crossPointA);
      vec3.copy(pointB, crossPointB);
    }
  }
  const diff = vec3.sub(vec3.create(), pointB, pointA);

  const canUseCylinderSettings =
    parallel && fullCircleCylinder(cylinderProduct, cylinderFaceData);

  if (
    (cylinderMeasure == "closest" || cylinderMeasure == "furthest") &&
    canUseCylinderSettings
  ) {
    vec3.normalize(diff, diff);
    vec3.scale(diff, diff, cylinder.radius * cylinderScale);
    if (cylinderMeasure == "closest") {
      vec3.add(pointA, pointA, diff);
    } else {
      vec3.sub(pointA, pointA, diff);
    }
    vec3.sub(diff, pointB, pointA);
  }
  return {
    drawKind: "measureResult",
    distance: vec3.length(diff),
    distanceX: Math.abs(diff[0]),
    distanceY: Math.abs(diff[1]),
    distanceZ: Math.abs(diff[2]),
    measureInfoA: { point: pointA, validMeasureSettings: canUseCylinderSettings },
    measureInfoB: { point: pointB, validMeasureSettings: canUseCylinderSettings }
  };
}

async function getCurveToSurfaceMeasureValues(
  curve: Curve3D,
  productA: ProductData,
  curveInstanceIdx: number,
  productB: ProductData,
  faceIdx: number,
  faceInstanceIdx: number,
  setting?: MeasureSettings
) {
  const faceData = productB.faces[faceIdx];
  const surfaceData = productB.surfaces[faceData.surface];
  const surface = MeasureTool.geometryFactory.getSurface(surfaceData, 1);
  if (surface) {
    const kindCombo = `${curve.kind}_${surface.kind}`;
    switch (kindCombo) {
      case "line_plane": {
        const line = curve as Line3D;
        const lineMat = matFromInstance(productA.instances[curveInstanceIdx]);
        const plane = surface as Plane;
        return lineToPlaneMeasure(
          lineToSegment(line, lineMat),
          plane,
          productB,
          faceData,
          faceInstanceIdx
        );
      }
      case "lineStrip_plane": {
        const stripMat = matFromInstance(productA.instances[curveInstanceIdx]);
        const strip = curve as LineStrip3D;
        const segments = strip.toSegments(stripMat);
        let minDist = 1000000;
        let bestMeasureValues: undefined | DuoMeasurementValues = undefined;
        const plane = surface as Plane;
        for (const seg of segments) {
          const measureValue = lineToPlaneMeasure(
            seg,
            plane,
            productB,
            faceData,
            faceInstanceIdx
          );
          if (measureValue && measureValue.distance && measureValue.distance < minDist) {
            bestMeasureValues = measureValue;
            minDist = measureValue.distance;
          }
        }
        return bestMeasureValues;
      }
      case "line_cylinder": {
        const line = curve as Line3D;
        const lineMat = matFromInstance(productA.instances[curveInstanceIdx]);

        const cylinder = surfaceData as CylinderData;
        const cylinderMat = matFromInstance(
          productB.instances[faceInstanceIdx]
        );
        return await lineToCylinderMeasure(
          lineToSegment(line, lineMat),
          cylinder,
          productB,
          faceData,
          cylinderMat,
          unitToScale(productB.units),
          setting?.cylinderMeasure ? setting.cylinderMeasure : "center"
        );
      }
      case "lineStrip_cylinder": {
        const stripMat = matFromInstance(productA.instances[curveInstanceIdx]);
        const cylinderMat = matFromInstance(
          productB.instances[faceInstanceIdx]
        );
        const strip = curve as LineStrip3D;
        const segments = strip.toSegments(stripMat);
        let minDist = 1000000;
        let bestMeasureValues: undefined | DuoMeasurementValues = undefined;
        for (const seg of segments) {
          const measureValue = await lineToCylinderMeasure(
            seg,
            surfaceData as CylinderData,
            productB,
            faceData,
            cylinderMat,
            unitToScale(productB.units),
            setting?.cylinderMeasure ? setting.cylinderMeasure : "center"
          );
          if (measureValue.distance && measureValue.distance < minDist) {
            bestMeasureValues = measureValue;
            minDist = measureValue.distance;
          }
        }
        return bestMeasureValues;
      }
    }
  }
}

export async function getEdgeToFaceMeasureValues(
  productA: ProductData,
  edgeIdx: number,
  edgeInstanceIdx: number,
  productB: ProductData,
  faceIdx: number,
  faceInstanceIdx: number,
  setting?: MeasureSettings
): Promise<DuoMeasurementValues | undefined> {
  const edgeCurve = MeasureTool.geometryFactory.getCurve3DFromEdge(
    productA,
    edgeIdx
  );
  if (edgeCurve) {
    return getCurveToSurfaceMeasureValues(
      edgeCurve,
      productA,
      edgeInstanceIdx,
      productB,
      faceIdx,
      faceInstanceIdx,
      setting
    );
  }
}

export async function getSegmentToFaceMeasureValues(
  productA: ProductData,
  segIdx: number,
  segInstanceIdx: number,
  productB: ProductData,
  faceIdx: number,
  faceInstanceIdx: number,
  setting?: MeasureSettings
): Promise<DuoMeasurementValues | undefined> {
  const segCurve = MeasureTool.geometryFactory.getCurve3DFromSegment(
    productA,
    segIdx
  );
  if (segCurve) {
    return getCurveToSurfaceMeasureValues(
      segCurve,
      productA,
      segInstanceIdx,
      productB,
      faceIdx,
      faceInstanceIdx,
      setting
    );
  }
}

function planeToPlaneMeasure(
  productA: ProductData,
  faceDataA: FaceData,
  instanceA: number,
  planeA: Plane,
  productB: ProductData,
  faceDataB: FaceData,
  instanceB: number,
  planeB: Plane
): DuoMeasurementValues | undefined {
  const [pointPlaneA, normA] = decomposePlane(
    productA,
    faceDataA,
    instanceA,
    planeA,
    true
  );
  const [pointPlaneB, normB] = decomposePlane(
    productB,
    faceDataB,
    instanceB,
    planeB
  );

  const dot = Math.abs(vec3.dot(normA, normB));
  if (dot > 0.999) {
    const d = vec3.dot(
      normA,
      vec3.subtract(vec3.create(), pointPlaneB, pointPlaneA)
    );
    const normalPointB = vec3.add(
      vec3.create(),
      pointPlaneA,
      vec3.scale(vec3.create(), normA, d)
    );
    const normalPointA = vec3.copy(vec3.create(), pointPlaneA);

    //swapAxis(pointA);
    //swapAxis(pointB);
    return {
      drawKind: "measureResult",
      distance: Math.abs(d),
      distanceX: 0,
      distanceY: 0,
      distanceZ: 0,
      normalPoints: [normalPointA, normalPointB],
    };
  }
}

async function cylinderToCylinderMeasure(
  cylinderA: CylinderData,
  matA: mat4,
  productA: ProductData,
  faceDataA: FaceData,
  scaleA: number,
  cylinderB: CylinderData,
  matB: mat4,
  productB: ProductData,
  faceDataB: FaceData,
  scaleB: number,
  cylinderMeasureA: CylinerMeasureType,
  cylinderMeasureB: CylinerMeasureType
): Promise<DuoMeasurementValues> {
  const [cylinderOrigoA, cylinderEndA] = await cylinderCenterLine(
    productA,
    faceDataA,
    cylinderA,
    matA,
    cylinderMeasureA
  );
  const dirA = vec3.sub(vec3.create(), cylinderEndA, cylinderOrigoA);
  vec3.normalize(dirA, dirA);

  const [cylinderOrigoB, cylinderEndB] = await cylinderCenterLine(
    productB,
    faceDataB,
    cylinderB,
    matB,
    cylinderMeasureB
  );
  const dirB = vec3.sub(vec3.create(), cylinderEndB, cylinderOrigoB);
  vec3.normalize(dirB, dirB);

  const parallel =
    vec3.equals(dirA, dirB) ||
    vec3.equals(dirA, vec3.negate(vec3.create(), dirB));
  let [distance, pointA, pointB] = closestProjectedPoints(
    cylinderOrigoA,
    cylinderEndA,
    cylinderOrigoB,
    cylinderEndB
  );

  const diff = vec3.sub(vec3.create(), pointA, pointB);

  const canUseCylinderSettings =
    parallel &&
    fullCircleCylinder(productA, faceDataA) &&
    fullCircleCylinder(productB, faceDataB);

  let angle: { radians: number, angleDrawInfo: [vec3, vec3, vec3], additionalLine: [vec3, vec3] | undefined } | undefined = undefined;

  if (!parallel) {
    const intersectionPoint = closestPointsToIntersection(
      cylinderOrigoA,
      cylinderEndA,
      cylinderOrigoB,
      cylinderEndB
    );
    const { pos: crossPointA } = closestPointToLine(
      intersectionPoint,
      cylinderOrigoA,
      cylinderEndA
    );
    const { pos: crossPointB } = closestPointToLine(
      intersectionPoint,
      cylinderOrigoB,
      cylinderEndB
    );
    if (vec3.dist(pointA, pointB) > vec3.dist(crossPointA, crossPointB)) {
      vec3.sub(diff, crossPointB, crossPointA);
      pointA = vec3.clone(crossPointA);
      pointB = vec3.clone(crossPointB);
    }


    if (vec3.length(diff) < 0.5) {
      let negate = false;
      //For correct angle calculation
      if (vec3.dist(pointA, cylinderEndA) < vec3.dist(pointA, cylinderOrigoA)) {
        vec3.negate(dirA, dirA);
      }
      if (vec3.dist(pointB, cylinderEndB) < vec3.dist(pointB, cylinderOrigoB)) {
        negate = true;
        vec3.negate(dirB, dirB);
      }

      let radians = vec3.angle(dirA, dirB);
      if (radians > Math.PI) {
        radians = Math.PI * 2 - radians;
      }

      let addAdditionalLine = false;
      if (radians > Math.PI / 2) {
        radians = Math.PI - radians;
        if (negate) {
          vec3.negate(dirB, dirB);
        } else {
          vec3.negate(dirA, dirA);
        }
        addAdditionalLine = true;
      }

      const center = vec3.add(vec3.create(), pointA, pointB);
      vec3.scale(center, center, 0.5);
      const anglePa = vec3.add(vec3.create(), center, dirA);
      const anglePb = vec3.add(vec3.create(), center, dirB);
      angle = {
        radians, angleDrawInfo: [center, anglePa, anglePb],
        additionalLine: addAdditionalLine ? [vec3.clone(center), vec3.clone(anglePa)] : undefined
      }
    }
  } else {
    vec3.normalize(diff, diff);
    const radiusDirA = vec3.scale(
      vec3.create(),
      diff,
      cylinderA.radius * scaleA * -1
    );
    const radiusDirB = vec3.scale(
      vec3.create(),
      diff,
      cylinderB.radius * scaleB
    );
    if (cylinderMeasureA == "closest") {
      vec3.add(pointA, pointA, radiusDirA);
    } else if (cylinderMeasureA == "furthest") {
      vec3.sub(pointA, pointA, radiusDirA);
    }
    if (cylinderMeasureB == "closest") {
      vec3.add(pointB, pointB, radiusDirB);
    } else if (cylinderMeasureB == "furthest") {
      vec3.sub(pointB, pointB, radiusDirB);
    }
    vec3.sub(diff, pointB, pointA);
  }

  return {
    drawKind: "measureResult",
    distance: vec3.length(diff),
    distanceX: Math.abs(diff[0]),
    distanceY: Math.abs(diff[1]),
    distanceZ: Math.abs(diff[2]),
    measureInfoA: { point: pointA, validMeasureSettings: canUseCylinderSettings },
    measureInfoB: { point: pointB, validMeasureSettings: canUseCylinderSettings },
    angle,
  };
}

function cylinderToPlaneMeasure(
  cylinder: CylinderData,
  cylinderInstanceMat: mat4,
  plane: Plane,
  planeProduct: ProductData,
  planeFace: FaceData,
  planeInstance: number,
  scale: number,
  canUseCylinderSettings: boolean,
  cylinderMeasure: CylinerMeasureType
): DuoMeasurementValues | undefined {
  const cylinderNormalMat = mat3.normalFromMat4(
    mat3.create(),
    cylinderInstanceMat
  );
  const cylinderMat = mat4.fromValues(
    ...(cylinder.transform as Parameters<typeof mat4.fromValues>)
  );
  const cylinderPoint = mat4.getTranslation(vec3.create(), cylinderMat);
  vec3.transformMat4(cylinderPoint, cylinderPoint, cylinderInstanceMat);
  const cylinderDir = vec3.fromValues(
    cylinderMat[8],
    cylinderMat[9],
    cylinderMat[10]
  );
  vec3.transformMat3(cylinderDir, cylinderDir, cylinderNormalMat);
  vec3.normalize(cylinderDir, cylinderDir);

  const [planePoint, planeNorm] = decomposePlane(
    planeProduct,
    planeFace,
    planeInstance,
    plane
  );
  const dot = vec3.dot(cylinderDir, planeNorm);
  const parallel = dot < 0.000001 && dot > -0.0001;
  if (parallel) {
    const d1 = vec3.dot(planeNorm, planePoint);
    const d2 = vec3.dot(planeNorm, cylinderPoint);
    let d = d2 - d1;
    if (cylinderMeasure == "closest") {
      d = d > 0 ? d - cylinder.radius * scale : d + cylinder.radius * scale;
    } else if (cylinderMeasure == "furthest") {
      d = d > 0 ? d + cylinder.radius * scale : d - cylinder.radius * scale;
    }
    const cylinerPlanePoint = vec3.add(
      vec3.create(),
      planePoint,
      vec3.scale(vec3.create(), planeNorm, d)
    );

    return {
      drawKind: "measureResult",
      normalDistance: Math.abs(d),
      distanceX: 0,
      distanceY: 0,
      distanceZ: 0,
      normalPoints: [planePoint, cylinerPlanePoint],
      measureInfoA: { validMeasureSettings: canUseCylinderSettings },
      measureInfoB: { validMeasureSettings: canUseCylinderSettings }
    };
  }
}

export async function getSegmentToSegmentMeasureValues(
  productA: ProductData,
  segIdxA: number,
  instanceIdxA: number,
  productB: ProductData,
  segIdxB: number,
  instanceIdxB: number
): Promise<DuoMeasurementValues | undefined> {
  let curveA = MeasureTool.geometryFactory.getCurve3DFromSegment(productA, segIdxA);
  let curveB = MeasureTool.geometryFactory.getCurve3DFromSegment(productB, segIdxB);
  if (curveA && curveB) {
    return getCurveToCurveMeasureValues(
      productA,
      curveA,
      instanceIdxA,
      productB,
      curveB,
      instanceIdxB
    );
  }
  return undefined;
}

export async function getSegmentToEdgeMeasureValues(
  productA: ProductData,
  segIdx: number,
  instanceIdxA: number,
  productB: ProductData,
  edgeIdx: number,
  instanceIdxB: number
): Promise<DuoMeasurementValues | undefined> {
  let curveA = MeasureTool.geometryFactory.getCurve3DFromSegment(productA, segIdx);
  let curveB = MeasureTool.geometryFactory.getCurve3DFromEdge(productB, edgeIdx);
  if (curveA && curveB) {
    return getCurveToCurveMeasureValues(
      productA,
      curveA,
      instanceIdxA,
      productB,
      curveB,
      instanceIdxB
    );
  }
  return undefined;
}

export async function getFaceToFaceMeasureValues(
  productA: ProductData,
  faceIdxA: number,
  instanceIdxA: number,
  productB: ProductData,
  faceIdxB: number,
  instanceIdxB: number,
  settingA?: MeasureSettings,
  settingB?: MeasureSettings
): Promise<DuoMeasurementValues | undefined> {
  const faceDataA = productA.faces[faceIdxA];
  const surfaceDataA = productA.surfaces[faceDataA.surface];
  let surfaceA = {
    surf: MeasureTool.geometryFactory.getSurface(surfaceDataA, 1),
    instanceIdx: instanceIdxA,
    faceData: faceDataA,
    data: surfaceDataA,
    product: productA,
    setting: settingA,
  };

  const faceDataB = productB.faces[faceIdxB];
  const surfaceDataB = productB.surfaces[faceDataB.surface];
  let surfaceB = {
    surf: MeasureTool.geometryFactory.getSurface(surfaceDataB, 1),
    instanceIdx: instanceIdxB,
    faceData: faceDataB,
    data: surfaceDataB,
    product: productB,
    setting: settingB,
  };

  if (surfaceA.surf && surfaceB.surf) {
    const entities = [surfaceA, surfaceB];
    entities.sort((a, b) => a.surf!.kind.localeCompare(b.surf!.kind));
    [surfaceA, surfaceB] = entities;
    const kindCombo = `${surfaceA.surf!.kind}_${surfaceB.surf!.kind}`;
    switch (kindCombo) {
      case "plane_plane":
        return planeToPlaneMeasure(
          surfaceA.product,
          surfaceA.faceData,
          surfaceA.instanceIdx,
          surfaceA.surf as Plane,
          surfaceB.product,
          surfaceB.faceData,
          surfaceB.instanceIdx,
          surfaceB.surf as Plane
        );

      case "cylinder_cylinder": {
        const cylinderA = surfaceA.data as CylinderData;
        const matA = matFromInstance(
          surfaceA.product.instances[surfaceA.instanceIdx]
        );

        const cylinderB = surfaceB.data as CylinderData;
        const matB = matFromInstance(
          surfaceB.product.instances[surfaceB.instanceIdx]
        );

        return cylinderToCylinderMeasure(
          cylinderA,
          matA,
          surfaceA.product,
          surfaceA.faceData,
          unitToScale(surfaceA.product.units),
          cylinderB,
          matB,
          surfaceB.product,
          surfaceB.faceData,
          unitToScale(surfaceB.product.units),
          surfaceA.setting?.cylinderMeasure ? surfaceA.setting.cylinderMeasure : "center",
          surfaceB.setting?.cylinderMeasure ? surfaceB.setting.cylinderMeasure : "center"
        );
      }

      case "cylinder_plane": {
        const cylinder = surfaceA.data as CylinderData;
        const cylinderInstanceMat = matFromInstance(
          surfaceA.product.instances[surfaceA.instanceIdx]
        );
        const canUseCylinderSettings = fullCircleCylinder(
          surfaceA.product,
          surfaceA.faceData
        );

        const plane = surfaceB.surf as Plane;
        return cylinderToPlaneMeasure(
          cylinder,
          cylinderInstanceMat,
          plane,
          surfaceB.product,
          surfaceB.faceData,
          surfaceB.instanceIdx,
          unitToScale(surfaceA.product.units),
          canUseCylinderSettings,
          surfaceA.setting?.cylinderMeasure && canUseCylinderSettings
            ? surfaceA.setting.cylinderMeasure
            : "center"
        );
      }
    }
  }
}

export async function evalCurve(
  product: ProductData,
  pathIdx: number,
  instanceIdx: number,
  paramter: number,
  pathKind: "edge" | "curveSegment"
): Promise<[ReadonlyVec3, ReadonlyVec3] | undefined> {
  const curve =
    pathKind == "edge"
      ? MeasureTool.geometryFactory.getCurve3DFromEdge(product, pathIdx)
      : MeasureTool.geometryFactory.getCurve3DFromSegment(product, pathIdx);
  if (curve) {
    paramter /= unitToScale(product.units);
    const pos = vec3.create();
    const dir = vec3.create();
    curve.eval(paramter, pos, dir);
    const mat = matFromInstance(product.instances[instanceIdx]);
    const normalMat = mat3.normalFromMat4(mat3.create(), mat);
    vec3.transformMat3(dir, dir, normalMat);
    vec3.transformMat4(pos, pos, mat);
    vec3.normalize(dir, dir);
    vec3.negate(dir, dir);
    return [pos, dir];
  }
}
