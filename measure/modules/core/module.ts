import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import { vec2, vec3 } from "gl-matrix";
import type { MeasureEntity, MeasureSettings, ObjectId, ParametricEntity } from "../../measure_view";
import { MeasureError } from "../../measure_view";
import type { LoadStatus, DuoMeasurementValues, MeasurementValues, SnapTolerance, LineStripMeasureValues } from ".";
import type { ParametricProduct } from "../../worker/parametric_product";
import { BaseModule } from "../base";
import type { CameraValues } from "../followPath";

/**
 * Standard measure module for standard measure functions
 */
export class CoreModule extends BaseModule {

    /**
     * Measure object, if b is undefined then single measure values are returned else the measurement between 2 objects
     * Standard measuring function for measure single or between 2 parametric objects.
     * @param a The entity that is being measured, this can either be a parametric object or a single point
     * @param b If this is defined then the measure function will return the measurement between a and b.
     * @param settingA settings for object a
     * @param settingB settings for object b
     * @returns  Measurement values either for a single object or between the objects
     */
    async measure(
        a: MeasureEntity,
        b?: MeasureEntity,
        settingA?: MeasureSettings,
        settingB?: MeasureSettings
    ): Promise<MeasurementValues | undefined> {
        return b
            ? await this.measurePair(a, b, settingA, settingB)
            : await this.measureSingle(a, settingA);
    }


    /** Returns the measure entity for given object and location, measure entity is a single part of a parametric object,
     * such as surface, edge or vertex. If the object and position does not contain parametric data a single vertex will be returned
     * @param id The object id of selected object
     * @param selectionPosition selected position, this is required to select the individual part of the parametric object
     * @param tolerance Tolerance for picking, the distance used is in meters
     * @returns Selected measure entity, this will be a vertex if nothing can be selected at the location
     * status if the object is loaded, and connection point where the parametric object has been selected.
     */
    async pickMeasureEntity(
        id: ObjectId,
        selectionPosition: ReadonlyVec3,
        tolerance?: SnapTolerance,
        allowGenerated?: boolean
    ): Promise<{ entity: MeasureEntity, status: LoadStatus, connectionPoint?: vec3 }> {
        const workerScene = await this.worker;
        const pos = vec3.copy(vec3.create(), selectionPosition);
        return await workerScene.pickEntity(id, pos, tolerance, allowGenerated);
    }

    /** 
    * @param id The object id of selected object
    * @returns the measure entity for given object if it is a single curveSegment 
    */
    async pickCurveSegment(id: ObjectId) {
        const workerScene = await this.worker;
        return await workerScene.getCurveSegmentEntity(id);
    }

    /** Returns the measure entity for given object and location if the current object is selected
     *  This is much faster than pickMeasureEntity and can be used for hover
     * @param id The object id of selected object
     * @param selectionPosition selected position, this is required to select the individual part of the parametric object
     * @param tolerance Tolerance for picking, the distance used is in meters
     * @returns Selected measure entity, this will be undefined if nothing is selectable at current position
     * **/
    async pickMeasureEntityOnCurrentObject(
        id: ObjectId,
        selectionPosition: ReadonlyVec3,
        tolerance: SnapTolerance,
        allowGenerated?: boolean
    ): Promise<{ entity: MeasureEntity | undefined, status: LoadStatus, connectionPoint?: vec3 }> {
        const workerScene = await this.worker;
        const pos = vec3.copy(vec3.create(), selectionPosition);
        return await workerScene.pickEntityOnCurrentObject(id, pos, tolerance, allowGenerated);
    }

    /** Novorender attempts to generate parametric data from tesselated objects if it is not provided in the file.
     * @param id The object id of selected object
     * @returns true if the parametric data is generated from novorender and not directly from parametric file
     * **/
    async isParametricDataGenerated(id: ObjectId) {
        const workerScene = await this.worker;
        return await workerScene.isBrepGenerated(id);
    }

    /**
     * @ignore
     * @privateRemarks not currently in use
     */
    async getParametricProduct(
        productId: number
    ): Promise<ParametricProduct | undefined> {
        const workerScene = await this.worker;
        return await workerScene.getProductObject(productId);
    }
    /**
     * @ignore
     * @privateRemarks not currently in use
     */
    async getCameraValues(
        a: ParametricEntity,
        cameraDir: vec3
    ): Promise<CameraValues | undefined> {
        const workerScene = await this.worker;
        return workerScene.getCameraValuesFromFace(
            a.ObjectId,
            a.pathIndex,
            a.instanceIndex,
            cameraDir
        );
    }


    /** 
     * Swaps between inner and outer cylinder, returns undefined if there is only one
     * @param entity Entity to be swapped
     * @param to Force cylinder to either be inner or outer
     * @returns Returns a new entity of the selected cylinder, if there is only one cylinder undefined is returned.
     */
    async swapCylinder(
        entity: MeasureEntity,
        to: "inner" | "outer"
    ): Promise<MeasureEntity | undefined> {
        if (entity.drawKind == "face") {
            const workerScene = await this.worker;
            const pathIdx = await workerScene.swapCylinder(
                entity.ObjectId,
                entity.pathIndex,
                entity.instanceIndex,
                to
            );
            if (pathIdx != undefined) {
                return {
                    ...entity,
                    pathIndex: pathIdx
                }
            }
        }
    }


    /**
     * Calculates the area from polygon. Treat polygon as closed, Z is treated as height and is ignored.
     * @param vertices Vertices defining the polygon, last and first vertex will be connected to create a closed polygon
     * @param normals Normals used to define the plane where the area is measured. IF the difference is too high it will use Z as the normal 
     * @returns The area of the selected polygon, do note this is 2d calulation and height is ignored
     */
    areaFromPolygon(
        vertices: ReadonlyVec3[],
        normals: ReadonlyVec3[]
    ): { area: number | undefined; polygon: ReadonlyVec3[] } {
        if (vertices.length == 0) {
            return { area: undefined, polygon: [] };
        }
        if (vertices.length != normals.length) {
            throw new MeasureError(
                "Area measurement",
                "Number of normals and vertices needs to be equal"
            );
        }
        let useXYPlane = false;
        const epsilon = 0.001;
        const normal = normals[0];
        for (let i = 1; i < normals.length; ++i) {
            if (1 - Math.abs(vec3.dot(normal, normals[i])) > epsilon) {
                useXYPlane = true;
                break;
            }
        }

        if (useXYPlane) {
            let total = 0;
            const polygon: ReadonlyVec3[] = [];
            for (let i = 0; i < vertices.length; i++) {
                let addX = vertices[i][0];
                let addY = vertices[i == vertices.length - 1 ? 0 : i + 1][1];
                let subX = vertices[i == vertices.length - 1 ? 0 : i + 1][0];
                let subY = vertices[i][1];

                total += addX * addY * 0.5;
                total -= subX * subY * 0.5;
                polygon.push(
                    vec3.fromValues(vertices[i][0], vertices[i][1], vertices[0][2])
                );
            }
            return { area: Math.abs(total), polygon };
        }

        const polygon: ReadonlyVec3[] = [];
        polygon.push(vertices[0]);
        const vertex = vertices[0];
        for (let i = 1; i < vertices.length; ++i) {
            const v = vertices[i];
            const vo = vec3.subtract(vec3.create(), v, vertex);
            const dist = vec3.dot(vo, normal) * -1;
            polygon.push(vec3.scaleAndAdd(vec3.create(), v, normal, dist));
        }

        if (polygon.length == 1) {
            return { area: 0, polygon };
        }
        const xDir = vec3.subtract(vec3.create(), polygon[1], polygon[0]);
        vec3.normalize(xDir, xDir);
        const yDir = vec3.cross(vec3.create(), normal, xDir);
        vec3.normalize(yDir, yDir);

        const polygon2d: ReadonlyVec2[] = [];
        polygon2d.push(vec2.fromValues(0, 0));
        for (let i = 1; i < vertices.length; ++i) {
            const p = polygon[i];
            const po = vec3.subtract(vec3.create(), p, vertex);
            polygon2d.push(vec2.fromValues(vec3.dot(po, xDir), vec3.dot(po, yDir)));
        }

        let total = 0;
        for (let i = 0; i < polygon2d.length; i++) {
            let addX = polygon2d[i][0];
            let addY = polygon2d[i == vertices.length - 1 ? 0 : i + 1][1];
            let subX = polygon2d[i == vertices.length - 1 ? 0 : i + 1][0];
            let subY = polygon2d[i][1];

            total += addX * addY * 0.5;
            total -= subX * subY * 0.5;
        }
        return { area: Math.abs(total), polygon };
    }

    /**
     * Measure between multiple points. Will return the angles, segment length and total length
     * @param vertices Vertices defining the line strip to be measured
     * @returns Angles, segment length and total length of the input linestrip
     */
    measureLineStrip(vertices: ReadonlyVec3[]): LineStripMeasureValues {
        let totalLength = 0;
        let segmentLengts: number[] = [];
        let angles: number[] = [];
        let prevSeg: ReadonlyVec3 | undefined = undefined;
        for (let i = 1; i < vertices.length; ++i) {
            const l = vec3.dist(vertices[i - 1], vertices[i]);
            totalLength += l;
            segmentLengts.push(l);
            const dir = vec3.sub(vec3.create(), vertices[i], vertices[i - 1]);
            vec3.normalize(dir, dir);
            if (prevSeg != undefined) {
                let angle = vec3.angle(prevSeg, dir);
                if (angle > Math.PI) {
                    angle = Math.PI * 2 - angle;
                }
                angles.push(angle);
            }
            vec3.negate(dir, dir);
            prevSeg = dir;
        }

        return { totalLength, linestrip: vertices, segmentLengts, angles };
    }

    /**
    * @ignore
    */
    private async measurePair(
        a: MeasureEntity,
        b: MeasureEntity,
        settingA?: MeasureSettings,
        settingB?: MeasureSettings
    ) {
        if (a.drawKind == "vertex") {
            if (b.drawKind == "vertex") {
                return this.pointToPoint(a.parameter as vec3, b.parameter as vec3);
            }
            return this.measureToPoint(b, a.parameter as vec3, settingB);
        }
        if (b.drawKind == "vertex") {
            return this.measureToPoint(a, b.parameter as vec3, settingA);
        }

        const workerScene = await this.worker;
        const entities = [
            { object: a, settings: settingA },
            { object: b, settings: settingB },
        ];
        entities.sort((a, b) => a.object.drawKind.localeCompare(b.object.drawKind));
        const [A, B] = entities;
        const kindCombo = `${A.object.drawKind}_${B.object.drawKind}`;
        switch (kindCombo) {
            case "curveSegment_curveSegment":
                return await workerScene.segmentToSegmentMeasure(
                    A.object.ObjectId,
                    A.object.pathIndex,
                    A.object.instanceIndex,
                    B.object.ObjectId,
                    B.object.pathIndex,
                    B.object.instanceIndex
                );
            case "curveSegment_edge":
                return await workerScene.segmentToEdgeMeasure(
                    A.object.ObjectId,
                    A.object.pathIndex,
                    A.object.instanceIndex,
                    B.object.ObjectId,
                    B.object.pathIndex,
                    B.object.instanceIndex
                );
            case "curveSegment_face":
                return await workerScene.segmentToFaceMeasure(
                    A.object.ObjectId,
                    A.object.pathIndex,
                    A.object.instanceIndex,
                    B.object.ObjectId,
                    B.object.pathIndex,
                    B.object.instanceIndex,
                    B.settings
                );
            case "edge_edge":
                return await workerScene.edgeToEdgeMeasure(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    b.ObjectId,
                    b.pathIndex,
                    b.instanceIndex
                );
            case "edge_face":
                return await workerScene.edgeToFaceMeasure(
                    A.object.ObjectId,
                    A.object.pathIndex,
                    A.object.instanceIndex,
                    B.object.ObjectId,
                    B.object.pathIndex,
                    B.object.instanceIndex,
                    B.settings
                );
            case "face_face":
                return await workerScene.faceToFaceMeasure(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    b.ObjectId,
                    b.pathIndex,
                    b.instanceIndex,
                    A.settings,
                    B.settings
                );
        }
    }

    /**
     * @ignore
     */
    private async measureSingle(a: MeasureEntity, setting?: MeasureSettings) {
        const workerScene = await this.worker;
        switch (a.drawKind) {
            case "curveSegment":
                return await workerScene.getCurveValues(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    "curveSegment"
                );
            case "edge":
                return await workerScene.getCurveValues(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    "edge"
                );
            case "face":
                return await workerScene.getFaceValues(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    setting
                );
        }
    }


    /**
     * @ignore
     */
    async measureToPoint(
        a: MeasureEntity,
        b: ReadonlyVec3,
        setting?: MeasureSettings
    ): Promise<DuoMeasurementValues | undefined> {
        const point = vec3.copy(vec3.create(), b);
        if (a.drawKind == "vertex") {
            return this.pointToPoint(a.parameter as vec3, point);
        }
        const workerScene = await this.worker;
        switch (a.drawKind) {
            case "curveSegment":
                return await workerScene.segmentToPointMeasure(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    point
                );
            case "edge":
                return await workerScene.edgeToPointMeasure(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    point
                );
            case "face":
                return await workerScene.faceToPointMeasure(
                    a.ObjectId,
                    a.pathIndex,
                    a.instanceIndex,
                    point,
                    setting
                );
        }
    }

    /**
     * @ignore
     * Measure distance between 2 points
     */
    pointToPoint(a: ReadonlyVec3, b: ReadonlyVec3): DuoMeasurementValues {
        const diff = vec3.sub(vec3.create(), a, b);
        return {
            drawKind: "measureResult",
            distance: vec3.len(diff),
            distanceX: Math.abs(diff[0]),
            distanceY: Math.abs(diff[1]),
            distanceZ: Math.abs(diff[2]),
            measureInfoA: { point: vec3.copy(vec3.create(), a) },
            measureInfoB: { point: vec3.copy(vec3.create(), b) }
        };
    }
}