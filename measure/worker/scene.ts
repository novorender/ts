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
import type { Curve3D } from "./curves";

glMatrix.setMatrixArrayType(Array);
export const epsilon = 0.0001;
const emptyHash = "00000000000000000000000000000000";

class BrepCache {
    data = new Map<ObjectId, ProductData | null | Promise<ProductData | undefined>>();
    snapInterfaces = new Map<ObjectId, PickInterface>();
    limit = 20_000_000;
    currentSize: number = 0;
    cache: { id: ObjectId, size: number }[] = [];
    addPromise(id: ObjectId, product: Promise<ProductData | undefined>) {
        this.data.set(id, product);
    }
    add(id: ObjectId, product: ProductData | null, size: number) {
        if (product != null) {
            while (this.currentSize + size > this.limit && this.cache.length > 0) {
                this.currentSize -= this.cache[0].size;
                this.data.delete(this.cache[0].id);
                this.snapInterfaces.delete(this.cache[0].id);
                this.cache.shift();
            }
            this.data.set(id, product);
            this.currentSize += size;
            this.cache.push({ id, size });
        }
        else {
            this.data.set(id, product);
        }
    }
    clear() {
        this.cache = [];
        this.currentSize = 0;
        this.data.clear();
        this.snapInterfaces.clear();
    }

    get(id: ObjectId) {
        return this.data.get(id);
    }

    async getSnapInterface(id: ObjectId): Promise<PickInterface | undefined> {
        const snap = this.snapInterfaces.get(id);
        if (snap) {
            return snap;
        }
        const product = await this.get(id);
        if (product) {
            const snapInterface = await getPickInterface(product, id);
            this.snapInterfaces.set(id, snapInterface);
            return snapInterface;
        }
    }
}

export class MeasureTool {
    downloader: Downloader = undefined!;
    crossSectionTool: RoadTool = undefined!;
    cache = new BrepCache;
    nextSnapIdx = 0;
    static geometryFactory: GeometryFactory = undefined!;
    idToHash: Uint8Array | undefined;
    private hasIdToHash = false;
    private lutPath: string | undefined;
    // For async access (unlike idToHash)
    private idToHashCache = new Map<number, string | Promise<string>>();
    private idToHashFileSize = 0;

    constructor() {
    }

    lookupHash(id: number) {
        const { idToHash } = this;
        if (idToHash && id < idToHash.length / 16) {
            const offset = id * 16;
            const slice = idToHash.subarray(offset, offset + 16);
            return this.byteSliceToHash(slice);
        }
        return undefined;
    }

    private async lookupHashAsync(id: number) {
        if (id < 0 || id >= this.idToHashFileSize / 16) {
            return;
        }

        let result = this.idToHashCache.get(id);
        if (!result) {
            const offset = id * 16;
            result = this.downloader.request(this.lutPath!, {
                headers: {
                    Range: `bytes=${offset}-${offset + 15}`
                }
            })
                .then(resp => resp.arrayBuffer())
                .then(slice => {
                    const result = this.byteSliceToHash(new Uint8Array(slice));
                    this.idToHashCache.set(id, result);
                    return result;
                });
            this.idToHashCache.set(id, result);
        }
        return await result;
    }

    private byteSliceToHash(bytes: Uint8Array) {
        return [...bytes].map(b => {
            const s = b.toString(16);
            return s.length < 2 ? s.length == 1 ? "0" + s : "00" : s;
        }).join("").toUpperCase();
    }

    async init(wasm: string | ArrayBuffer) {
        MeasureTool.geometryFactory = await createGeometryFactory(wasm);
    }

    async loadScene(baseUrl: string, lutPath: string) {
        const url = new URL(baseUrl);
        const idx = lutPath.indexOf("/") + 1;
        if (idx > 0) {
            const dir = lutPath.substring(0, idx);
            url.pathname += dir;
            lutPath = lutPath.substring(idx);
        }
        this.downloader = new Downloader(url);
        if (lutPath.length === 0) {
            lutPath = "object_id_to_brep_hash";
        }
        this.lutPath = lutPath;
        try {
            // Offline storage doesn't distinguish between request methods,
            // so we'll get GET from offline which is ok
            // In this case use sync id hash
            const resp = await this.downloader.request(lutPath, { method: 'HEAD' });
            this.hasIdToHash = resp.status === 200;
            if (this.hasIdToHash) {
                const body = await resp.arrayBuffer();
                if (body.byteLength > 0) {
                    this.idToHash = new Uint8Array(body);
                } else {
                    this.idToHashFileSize = Number(resp.headers.get('Content-Length'));
                }
            }
        } catch {
            this.idToHash = undefined;
        }

        this.crossSectionTool = new RoadTool(new URL(baseUrl));
        this.cache.clear();
    }

    async downloadBrep(id: number): Promise<{ product: ProductData, size: number } | null> {
        if (this.hasIdToHash) {
            const hash = this.idToHash ? this.lookupHash(id) : await this.lookupHashAsync(id);
            try {
                return hash && hash !== emptyHash ? await this.downloader.downloadJsonWithSize(hash) : null;
            } catch {
                return null;
            }
        } else {
            try {
                return await this.downloader.downloadJsonWithSize(`${id}.json`);
            } catch {
                return null;
            }
        }
    }

    private async getProduct(
        id: ObjectId
    ): Promise<ProductData | undefined> {
        let product = this.cache.get(id);
        if (product === undefined) {
            product = this.downloadBrep(id)
                .then(product => {
                    if (product?.product && product.product.instances === undefined) {
                        this.cache.add(id, null, 0);
                        return undefined;
                    }
                    this.cache.add(id, product?.product ?? null, product?.size ?? 0);
                    return product?.product ?? undefined;
                });
            this.cache.addPromise(id, product);
        }
        return await product ?? undefined;
    }

    async isBrepGenerated(id: ObjectId) {
        const product = await this.getProduct(id);
        if (product) {
            return product.version !== undefined;
        }
        return false;
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
            if (faceData.surface === undefined) {
                return undefined;
            }
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


    async pickEntity(id: ObjectId, position: vec3, tolerance?: SnapTolerance, allowGenerated?: boolean):
        Promise<{ entity: MeasureEntity, status: LoadStatus, connectionPoint?: vec3 }> {
        const product = await this.getProduct(id);
        if (product && (allowGenerated || product.version === undefined)) {
            const snapInterface = await this.cache.getSnapInterface(id);
            if (snapInterface) {
                const tol = tolerance ?? { edge: 0.032, segment: 0.12, face: 0.20, point: 0.032 };
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

    async pickEntityOnCurrentObject(id: ObjectId, position: vec3, tolerance: SnapTolerance, allowGenerated?: boolean):
        Promise<{ entity: MeasureEntity | undefined, status: LoadStatus, connectionPoint?: vec3 }> {
        const product = await this.cache.get(id);
        if (product === null || (!allowGenerated && product && product.version !== undefined)) {
            return {
                entity: undefined, status: "missing"
            }
        }
        const snapInterface = await this.cache.getSnapInterface(id);
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

    async getCurveSegmentEntity(
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

    tesselateCurveSegment(
        product: ProductData,
        curveSeg: Curve3D,
        instanceIdx: number
    ): ReadonlyVec3[] {
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
        return [];
    }

    async getCurveFromSegment(id: ObjectId,
        curveSegmentIdx: number) {
        const product = await this.getProduct(id);
        if (product) {
            const curveSeg = MeasureTool.geometryFactory.getCurve3DFromSegment(
                product,
                curveSegmentIdx
            );
            return curveSeg;
        }
    }

    async getCurveSegmentDrawObject(id: ObjectId,
        curveSegmentIdx: number,
        instanceIdx: number,
        segmentLabelInterval?: number): Promise<DrawObject> {
        const product = await this.getProduct(id);
        if (product) {
            const curve = await this.getCurveFromSegment(id, curveSegmentIdx);
            if (curve) {
                const wsVertices = await this.tesselateCurveSegment(
                    product,
                    curve,
                    instanceIdx
                );
                const drawObject = {
                    kind: "curveSegment",
                    parts: [{ vertices3D: wsVertices, drawType: "lines" }]
                } as DrawObject;
                if (segmentLabelInterval && segmentLabelInterval > 0) {
                    const texts: string[] = [];
                    const vertices3D: ReadonlyVec3[] = [];
                    for (let p = curve.beginParam; p < curve.endParam; p += segmentLabelInterval) {
                        const pos = vec3.create();
                        curve.eval(p, pos, undefined);
                        vertices3D.push(pos);
                        texts.push(`P = ${p.toFixed(0)}`);
                    }
                    drawObject.parts.push({ drawType: "text", vertices3D, text: [texts] });
                    return { ...drawObject, kind: "complex" };
                }
                return drawObject;
            }
        }

        return {
            kind: "curveSegment",
            parts: [{ vertices3D: [], drawType: "lines" }]
        };
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
            const surface = face.surface ?
                product.surfaces[face.surface] : undefined;;
            let drawParts: DrawPart[] = [];
            const kind = surface ? surface.kind == "cylinder" ? "cylinder" : "plane" : "unknown";
            if (kind == "cylinder") {
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
