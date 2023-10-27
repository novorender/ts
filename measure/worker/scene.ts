import type { ReadonlyMat4, ReadonlyVec3 } from "gl-matrix";
import { glMatrix, mat4, vec3 } from "gl-matrix";
import type { CylinderData, ProductData } from "./brep";
import {
  cylinderCenterLine,
  edgeToPointMeasureValues,
  faceToPointMeasureValues,
  getSegmentToSegmentMeasureValues,
  getSegmentToEdgeMeasureValues,
  getEdgeToEdgeMeasureValues,
  getEdgeToFaceMeasureValues,
  getFaceToFaceMeasureValues,
  getSegmentToFaceMeasureValues,
  segmentToPointMeasureValues,
  evalCurve,
} from "./calculations";
import { unitToScale, matFromInstance, GeometryFactory, createGeometryFactory } from "./loader";
import { getBrepEdges, getBrepFaces, getEdgeStrip, type PathInfo } from "./outline";
import { Downloader, getProfile, reduceLineStrip, swapCylinderImpl, } from "./util";
import { type ParametricProduct, toParametricProduct } from "./parametric_product";
import {
  addCenterLinesFromCylinders,
  centerLinesToLinesTrip,
  getCurveSegmentProfile,
  getCylinderProfile,
  reduceProfile,
} from "./profile";
import {
  extractCameraValuesFromFace,
  extractCurveValues,
  extractFaceValues,
} from "./extract_values";
import { manholeMeasure } from "./manhole";
import { getCylinderDrawParts, getManholeDrawObjects, getSurfaceDrawParts } from "./draw_objects";
import { getFaceToFaceCollisionValues } from "./collision";
import { getPickInterface, pick, type PickInterface } from "./snaps";
import { RoadTool } from "./roads/scene";
import type { CameraValues, CollisionValues, CrossSlope, DrawObject, DrawPart, DuoMeasurementValues, EdgeValues, FaceValues, LoadStatus, ManholeMeasureValues, MeasureEntity, MeasureSettings, ObjectId, ParameterBounds, Profile, RoadCrossSection, RoadProfiles, SnapTolerance } from "measure";

glMatrix.setMatrixArrayType(Array);
export const epsilon = 0.0001;

export class MeasureTool {
  downloader: Downloader = undefined!;
  crossSectionTool: RoadTool = undefined!;
  data = new Map<ObjectId, ProductData | null>();
  snapObjects = new Array<PickInterface>();
  nextSnapIdx = 0;
  static geometryFactory: GeometryFactory = undefined!;
  idToHash: Uint8Array | undefined;

  constructor() {
  }

  lookupHash(id: number) {
    const { idToHash } = this;
    if (idToHash && id < idToHash.length / 16) {
      const offset = id * 16;
      const slice = idToHash.subarray(offset, offset + 16);
      return [...slice].map(b => {
        const s = b.toString(16);
        return s.length < 2 ? s.length == 1 ? "0" + s : "00" : s;
      }).join("").toUpperCase();
    }
    return undefined;
  }

  async init(wasm: string | ArrayBuffer) {
    MeasureTool.geometryFactory = await createGeometryFactory(wasm);
  }

  async loadScene(baseUrl: string) {
    const brepUrl = new URL(baseUrl);
    brepUrl.pathname += "brep/";
    this.downloader = new Downloader(brepUrl);

    try {
      this.idToHash = new Uint8Array(await this.downloader.downloadArrayBuffer("object_id_to_brep_hash"));
    } catch {
      this.idToHash = undefined;
    }

    this.crossSectionTool = new RoadTool(new URL(baseUrl));
    this.data.clear();
    this.snapObjects.length = 0;
  }

  async getSnapInterface(id: number, product: ProductData | undefined): Promise<PickInterface | undefined> {
    for (const pickInterface of this.snapObjects) {
      if (pickInterface.objectId == id) {
        return pickInterface;
      }
    }
    if (product) {
      if (this.nextSnapIdx == 6) {
        this.nextSnapIdx = 0;
      }
      const snapInterface = await getPickInterface(product, id);
      this.snapObjects[this.nextSnapIdx++] = snapInterface;
      return snapInterface;
    }
  }

  async downloadBrep(id: number): Promise<ProductData | null> {
    const { idToHash } = this;
    if (idToHash) {
      const hash = this.lookupHash(id);
      try {
        return hash ? await this.downloader.downloadJson(hash) : null;
      } catch {
        return null;
      }
    } else {
      try {
        return await this.downloader.downloadJson(`${id}.json`);
      } catch {
        return null;
      }
    }
  }

  private async getProduct(
    id: ObjectId
  ): Promise<ProductData | undefined> {
    let product = this.data.get(id);
    if (product === undefined) {
      product = await this.downloadBrep(id);
      if (product && product.instances === undefined) {
        this.data.set(id, null);
        return undefined;
      }
      this.data.set(id, product);
    }
    return product ?? undefined;
  }

  async getCameraValuesFromFace(
    id: ObjectId,
    faceIdx: number,
    instanceIdx: number,
    cameraDir: vec3
  ): Promise<CameraValues | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return extractCameraValuesFromFace(
        product,
        faceIdx,
        instanceIdx,
        cameraDir
      );
    }
    return undefined;
  }

  async getFaces(
    id: ObjectId,
    viewWorldMatrix: ReadonlyMat4
  ): Promise<PathInfo[]> {
    const product = await this.getProduct(id);
    if (product) {
      const worldViewMatrix = mat4.create();
      mat4.invert(worldViewMatrix, viewWorldMatrix);
      const faces = MeasureTool.geometryFactory.getFaces(product);
      const paths = getBrepFaces(faces, worldViewMatrix).filter(
        (p) => p.path.length > 0
      );
      paths.sort((a, b) => a.centerDepth - b.centerDepth);
      return paths;
    }
    return [];
  }

  async getProductObject(
    productId: number
  ): Promise<ParametricProduct | undefined> {
    const product = await this.getProduct(productId);
    if (product) {
      return toParametricProduct(productId, product);
    }
    return undefined;
  }

  async getSnaps(productId: number) {
    const product = await this.getProduct(productId);
    if (product) {
    }
    return undefined;
  }

  async getParameterBoundsForCurve(
    id: ObjectId,
    pathIdx: number,
    pathKind: "edge" | "curveSegment"
  ): Promise<ParameterBounds | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      const parameterData =
        pathKind == "edge"
          ? product.edges[pathIdx]
          : product.curveSegments[pathIdx];
      const scale = unitToScale(product.units);
      return {
        start: parameterData.parameterBounds[0] * scale,
        end: parameterData.parameterBounds[1] * scale,
      };
    }
    return undefined;
  }

  async evalCurve(
    id: ObjectId,
    pathIdx: number,
    instanceIdx: number,
    parameter: number,
    pathKind: "edge" | "curveSegment"
  ): Promise<[ReadonlyVec3, ReadonlyVec3] | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return evalCurve(product, pathIdx, instanceIdx, parameter, pathKind);
    }
    return undefined;
  }

  async getCylinderCurve(
    id: ObjectId,
    faceIdx: number,
    instanceIdx: number,
    setting?: MeasureSettings
  ): Promise<[ParameterBounds, [ReadonlyVec3, ReadonlyVec3]] | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      const faceData = product.faces[faceIdx];
      const scale = unitToScale(product.units);
      const surfaceData = product.surfaces[faceData.surface];
      const surface = MeasureTool.geometryFactory.getSurface(
        surfaceData,
        faceData.facing,
        scale
      );
      if (surface.kind == "cylinder") {
        const cylinderData = surfaceData as CylinderData;
        const mat = matFromInstance(product.instances[instanceIdx]);
        const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
          product,
          faceData,
          cylinderData,
          mat,
          setting ? setting.cylinderMeasure : "center"
        );
        return [
          { start: 0, end: vec3.dist(cylinderOrigo, cylinderEnd) },
          [cylinderOrigo, cylinderEnd],
        ];
      }
    }
    return undefined;
  }


  async pickEntity(id: ObjectId, position: vec3, tolerance?: SnapTolerance):
    Promise<{ entity: MeasureEntity, status: LoadStatus, connectionPoint?: vec3 }> {
    const product = await this.getProduct(id);
    if (product) {
      const snapInterface = await this.getSnapInterface(id, product);
      if (snapInterface) {
        const tol = tolerance ?? { edge: 0.032, segment: 0.12, face: 0.07, point: 0.032 };
        const pickedEntity = pick(snapInterface, position, tol);
        if (pickedEntity) {
          return { entity: pickedEntity.entity, status: "loaded", connectionPoint: pickedEntity.connectionPoint };
        }
      }
    }
    return {
      entity: { ObjectId: id, parameter: position, drawKind: "vertex" }, status: "missing"
    };
  }

  async pickEntityOnCurrentObject(id: ObjectId, position: vec3, tolerance: SnapTolerance):
    Promise<{ entity: MeasureEntity | undefined, status: LoadStatus, connectionPoint?: vec3 }> {
    const product = this.data.get(id);
    if (product === null) {
      return {
        entity: undefined, status: "missing"
      }
    }
    const snapInterface = await this.getSnapInterface(id, undefined);
    if (snapInterface) {
      const p = pick(snapInterface, position, tolerance);
      return { entity: p?.entity, status: "loaded", connectionPoint: p?.connectionPoint };
    }
    return {
      entity: undefined, status: "unknown"
    }
  }

  async getEdges(
    id: ObjectId,
    viewWorldMatrix: ReadonlyMat4
  ): Promise<PathInfo[]> {
    const product = await this.getProduct(id);
    if (product) {
      const worldViewMatrix = mat4.create();
      mat4.invert(worldViewMatrix, viewWorldMatrix);
      const edges = MeasureTool.geometryFactory.getEdges(product);
      const paths = getBrepEdges(edges, worldViewMatrix).filter(
        (p) => p.path.length > 0
      );
      return paths;
    }
    return [];
  }

  async getPaths(
    id: ObjectId,
    worldViewMatrix: ReadonlyMat4
  ): Promise<PathInfo[]> {
    const product = await this.getProduct(id);
    if (product) {
      const faces = MeasureTool.geometryFactory.getFaces(product);
      const facePaths = getBrepFaces(faces, worldViewMatrix).filter(
        (p) => p.path.length > 0
      );
      facePaths.sort((a, b) => a.centerDepth - b.centerDepth);
      const edges = MeasureTool.geometryFactory.getEdges(product);
      const edgePaths = getBrepEdges(edges, worldViewMatrix).filter(
        (p) => p.path.length > 0
      );

      return [...facePaths, ...edgePaths];
    }
    return [];
  }

  async viableFollowPathEntity(
    id: ObjectId
  ): Promise<MeasureEntity | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      if (product.curveSegments && product.curveSegments.length > 0) {
        if (product.curveSegments.length === 1) {
          return {
            ObjectId: id,
            drawKind: "curveSegment",
            pathIndex: 0,
            instanceIndex: 0,
            parameter: 0,
          };
        }
      }
    }
  }

  async getTesselatedEdge(
    id: ObjectId,
    edgeIdx: number,
    instanceIdx: number
  ): Promise<ReadonlyVec3[]> {
    const product = await this.getProduct(id);
    if (product) {
      const edgeCurve = MeasureTool.geometryFactory.getCurve3DFromEdge(
        product,
        edgeIdx
      );
      if (edgeCurve) {
        const edge = {
          curve: edgeCurve,
          geometryTransformation: matFromInstance(
            product.instances[instanceIdx]
          ),
          instanceIndex: instanceIdx,
        };
        return getEdgeStrip(edge, 1);
      }
    }
    return [];
  }

  async tesselateCurveSegment(
    id: ObjectId,
    curveSegmentIdx: number,
    instanceIdx: number
  ): Promise<ReadonlyVec3[]> {
    const product = await this.getProduct(id);
    if (product) {
      const curveSeg = MeasureTool.geometryFactory.getCurve3DFromSegment(
        product,
        curveSegmentIdx
      );
      if (curveSeg) {
        const curve = {
          curve: curveSeg,
          geometryTransformation: matFromInstance(
            product.instances[instanceIdx]
          ),
          instanceIndex: instanceIdx,
        };
        return getEdgeStrip(curve, 1);
      }
    }
    return [];
  }

  async curveSegmentProfile(
    id: ObjectId,
    curveSegmentIdx: number,
    instanceIdx: number
  ): Promise<Profile | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      const curveSeg = MeasureTool.geometryFactory.getCurve3DFromSegment(
        product,
        curveSegmentIdx
      );
      if (curveSeg) {
        return getCurveSegmentProfile(product, curveSeg, instanceIdx);
      }
    }
    return undefined;
  }

  async cylinderProfile(
    id: ObjectId,
    faceIdx: number,
    instanceIdx: number,
    setting?: MeasureSettings
  ): Promise<Profile | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return await getCylinderProfile(product, faceIdx, instanceIdx, setting);
    }
    return undefined;
  }

  async multiSelectProfile(
    products: ObjectId[],
    setting?: MeasureSettings
  ): Promise<Profile | undefined | string> {
    const centerLines: {
      start: ReadonlyVec3;
      end: ReadonlyVec3;
      radius: number;
      prev: number | undefined;
      next: number | undefined;
    }[] = [];
    for (const id of products) {
      const product = await this.getProduct(id);
      if (product) {
        if (product.curveSegments && product.curveSegments.length > 0) {
          if (product.curveSegments.length === 1 && products.length === 1) {
            const segProfile = await this.curveSegmentProfile(id, 0, 0);
            if (segProfile) {
              return segProfile;
            }
          } else {
            return "Multiple segments in profile";
          }
        }

        await addCenterLinesFromCylinders(
          product,
          centerLines,
          unitToScale(product.units),
          setting
        );
      }
    }

    const lineStrip = reduceLineStrip(centerLinesToLinesTrip(centerLines));
    if (lineStrip.length > 1) {
      const profile = getProfile(lineStrip, undefined, undefined);
      return reduceProfile(profile);
    }
    return undefined;
  }

  async getLineStripFromCylinders(
    products: ObjectId[],
    setting?: MeasureSettings
  ) {
    const lineStrip = await this.cylindersToLinestrip(products, setting);
    for (const p of lineStrip) {
    }
    return lineStrip;
  }

  async cylindersToLinestrip(
    products: ObjectId[],
    setting?: MeasureSettings
  ): Promise<ReadonlyVec3[]> {
    const centerLines: {
      start: ReadonlyVec3;
      end: ReadonlyVec3;
      radius: number;
      prev: number | undefined;
      next: number | undefined;
    }[] = [];
    for (const id of products) {
      const product = await this.getProduct(id);
      if (product) {
        await addCenterLinesFromCylinders(
          product,
          centerLines,
          unitToScale(product.units),
          setting
        );
      }
    }
    return reduceLineStrip(centerLinesToLinesTrip(centerLines));
  }

  async getFaceDrawObject(
    id: ObjectId,
    faceIdx: number,
    instanceIdx: number,
    setting?: MeasureSettings
  ): Promise<DrawObject | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      const face = product.faces[faceIdx];
      const surface = product.surfaces[face.surface];
      let drawParts: DrawPart[] = [];
      const kind = surface.kind == "cylinder" ? "cylinder" : "plane";
      if (surface.kind == "cylinder") {
        drawParts = await getCylinderDrawParts(product, instanceIdx, surface as CylinderData, face, setting);
      } else {
        drawParts = await getSurfaceDrawParts(product, instanceIdx, face);
      }
      return { kind, parts: drawParts };
    }
    return undefined;
  }

  async edgeToEdgeMeasure(
    idA: ObjectId,
    edgeIdxA: number,
    instanceIdxA: number,
    idB: ObjectId,
    edgeIdxB: number,
    instanceIdxB: number
  ): Promise<DuoMeasurementValues | undefined> {
    const productA = await this.getProduct(idA);
    const productB = await this.getProduct(idB);
    if (productA && productB) {
      return await getEdgeToEdgeMeasureValues(
        productA,
        edgeIdxA,
        instanceIdxA,
        productB,
        edgeIdxB,
        instanceIdxB
      );
    }
  }

  async edgeToPointMeasure(
    id: ObjectId,
    edgeIdx: number,
    instanceIdx: number,
    point: vec3
  ): Promise<DuoMeasurementValues | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return await edgeToPointMeasureValues(
        product,
        edgeIdx,
        instanceIdx,
        point
      );
    }
  }

  async segmentToPointMeasure(
    id: ObjectId,
    segIdx: number,
    instanceIdx: number,
    point: vec3
  ): Promise<DuoMeasurementValues | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return await segmentToPointMeasureValues(
        product,
        segIdx,
        instanceIdx,
        point
      );
    }
  }

  async faceToPointMeasure(
    id: ObjectId,
    faceIdx: number,
    instanceIdx: number,
    point: vec3,
    setting?: MeasureSettings
  ): Promise<DuoMeasurementValues | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return await faceToPointMeasureValues(
        product,
        faceIdx,
        instanceIdx,
        point,
        unitToScale(product.units),
        setting
      );
    }
  }

  async edgeToFaceMeasure(
    idA: ObjectId,
    edgeIdx: number,
    edgeInstanceIdx: number,
    idB: ObjectId,
    faceIdx: number,
    faceInstanceIdx: number,
    setting?: MeasureSettings
  ): Promise<DuoMeasurementValues | undefined> {
    const productA = await this.getProduct(idA);
    const productB = await this.getProduct(idB);
    if (productA && productB) {
      return await getEdgeToFaceMeasureValues(
        productA,
        edgeIdx,
        edgeInstanceIdx,
        productB,
        faceIdx,
        faceInstanceIdx,
        setting
      );
    }
    return undefined;
  }

  async faceToFaceMeasure(
    idA: ObjectId,
    faceIdxA: number,
    instanceIdxA: number,
    idB: ObjectId,
    faceIdxB: number,
    instanceIdxB: number,
    settingA?: MeasureSettings,
    settingB?: MeasureSettings
  ): Promise<DuoMeasurementValues | undefined> {
    const productA = await this.getProduct(idA);
    const productB = await this.getProduct(idB);
    if (productA && productB) {
      return await getFaceToFaceMeasureValues(
        productA,
        faceIdxA,
        instanceIdxA,
        productB,
        faceIdxB,
        instanceIdxB,
        settingA,
        settingB
      );
    }
    return undefined;
  }

  async segmentToSegmentMeasure(
    idA: ObjectId,
    segIdxA: number,
    instanceIdxA: number,
    idB: ObjectId,
    segIdxB: number,
    instanceIdxB: number
  ): Promise<DuoMeasurementValues | undefined> {
    const productA = await this.getProduct(idA);
    const productB = await this.getProduct(idB);
    if (productA && productB) {
      return await getSegmentToSegmentMeasureValues(
        productA,
        segIdxA,
        instanceIdxA,
        productB,
        segIdxB,
        instanceIdxB
      );
    }
    return undefined;
  }

  async segmentToEdgeMeasure(
    idA: ObjectId,
    segIdx: number,
    segInstanceIdx: number,
    idB: ObjectId,
    edgeIdx: number,
    edgeInstanceIdx: number
  ): Promise<DuoMeasurementValues | undefined> {
    const productA = await this.getProduct(idA);
    const productB = await this.getProduct(idB);
    if (productA && productB) {
      return await getSegmentToEdgeMeasureValues(
        productA,
        segIdx,
        segInstanceIdx,
        productB,
        edgeIdx,
        edgeInstanceIdx
      );
    }
    return undefined;
  }

  async segmentToFaceMeasure(
    idA: ObjectId,
    segIdx: number,
    segInstanceIdx: number,
    idB: ObjectId,
    faceIdx: number,
    faceInstanceIdx: number,
    setting?: MeasureSettings
  ): Promise<DuoMeasurementValues | undefined> {
    const productA = await this.getProduct(idA);
    const productB = await this.getProduct(idB);
    if (productA && productB) {
      return await getSegmentToFaceMeasureValues(
        productA,
        segIdx,
        segInstanceIdx,
        productB,
        faceIdx,
        faceInstanceIdx,
        setting
      );
    }
    return undefined;
  }

  async getCurveValues(
    id: ObjectId,
    pathIdx: number,
    instanceIdx: number,
    pathKind: "edge" | "curveSegment"
  ): Promise<EdgeValues | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return extractCurveValues(product, pathIdx, instanceIdx, pathKind);
    }
  }

  async getFaceValues(
    id: ObjectId,
    faceIdx: number,
    instanceIdx: number,
    setting?: MeasureSettings
  ): Promise<FaceValues | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return extractFaceValues(id, product, faceIdx, instanceIdx, setting);
    }
  }

  async getManholeValues(id: ObjectId): Promise<ManholeMeasureValues | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return manholeMeasure(product, id);
    }
    return undefined;
  }

  async getManholeDrawObject(entity: ManholeMeasureValues) {
    const product = await this.getProduct(entity.ObjectId);
    if (product) {
      return getManholeDrawObjects(product, entity);
    }
    return [];
  }

  async swapCylinder(
    id: ObjectId,
    faceIdx: number,
    instanceIdx: number,
    to: "inner" | "outer"
  ): Promise<number | undefined> {
    const product = await this.getProduct(id);
    if (product) {
      return swapCylinderImpl(product, faceIdx, instanceIdx, to);
    }
  }

  async faceToFaceCollision(
    idA: ObjectId,
    faceIdxA: number,
    instanceIdxA: number,
    idB: ObjectId,
    faceIdxB: number,
    instanceIdxB: number,
    setting?: MeasureSettings
  ): Promise<CollisionValues | undefined> {
    const productA = await this.getProduct(idA);
    const productB = await this.getProduct(idB);
    if (productA && productB) {
      return await getFaceToFaceCollisionValues(
        productA,
        faceIdxA,
        instanceIdxA,
        productB,
        faceIdxB,
        instanceIdxB,
        setting
      );
    }
    return undefined;
  }

  //Road stuff
  async getRoadProfile(roadId: string): Promise<RoadProfiles | undefined> {
    return await this.crossSectionTool.getRoadProfiles(roadId);
  }

  async getRoadCrossSlope(roadId: string): Promise<CrossSlope | undefined> {
    return await this.crossSectionTool.getCrossSlope(roadId);
  }

  async getCrossSection(roadId: string, profileNumber: number): Promise<RoadCrossSection | undefined> {
    return await this.crossSectionTool.getCrossSection(roadId, profileNumber);
  }
}
