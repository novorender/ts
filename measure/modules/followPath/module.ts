import { vec3, type ReadonlyVec3 } from "gl-matrix";
import type { MeasureEntity, MeasureSettings, ObjectId, ParametricEntity } from "../../measure_view";
import { BaseModule } from "../base";
import type { CameraValues, FollowParametricObject, ParameterBounds } from ".";

export class FollowModule extends BaseModule {
    /**
     * @ignore
     */
    private async followParametricEntity(
        id: ObjectId,
        entity: ParametricEntity,
        setting?: MeasureSettings
    ) {
        const workerScene = await this.worker;
        let parameterBounds: ParameterBounds | undefined = undefined;
        let emulatedCurve: { start: ReadonlyVec3; dir: ReadonlyVec3 } | undefined =
            undefined;
        let type: "edge" | "cylinder" | "curve" | undefined = undefined;
        switch (entity.drawKind) {
            case "edge": {
                type = "edge";
                parameterBounds = await workerScene.getParameterBoundsForCurve(
                    id,
                    entity.pathIndex,
                    "edge"
                );
                break;
            }
            case "face": {
                const cylinderData = await workerScene.getCylinderCurve(
                    id,
                    entity.pathIndex,
                    entity.instanceIndex,
                    setting
                );
                if (cylinderData) {
                    type = "cylinder";
                    parameterBounds = cylinderData[0];
                    emulatedCurve = {
                        start: cylinderData[1][0],
                        dir: vec3.normalize(
                            vec3.create(),
                            vec3.subtract(
                                vec3.create(),
                                cylinderData[1][1],
                                cylinderData[1][0]
                            )
                        ),
                    };
                }
                break;
            }
            case "curveSegment": {
                type = "curve";
                parameterBounds = await workerScene.getParameterBoundsForCurve(
                    id,
                    entity.pathIndex,
                    "curveSegment"
                );
                break;
            }
        }

        if (parameterBounds && type) {
            async function getCameraValues(
                t: number
            ): Promise<CameraValues | undefined> {
                if (emulatedCurve) {
                    const param =
                        t < 0 ? 0 : t > parameterBounds!.end ? parameterBounds!.end : t;
                    return {
                        position: vec3.scaleAndAdd(
                            vec3.create(),
                            emulatedCurve.start,
                            emulatedCurve.dir,
                            param
                        ),
                        normal: vec3.negate(vec3.create(), emulatedCurve.dir),
                    };
                }
                const curveVaues = await workerScene.evalCurve(
                    id,
                    entity!.pathIndex,
                    entity!.instanceIndex,
                    t,
                    entity!.drawKind == "edge" ? "edge" : "curveSegment"
                );
                if (curveVaues) {
                    return { position: curveVaues[0], normal: curveVaues[1] };
                }
            }
            const selectedEntity: MeasureEntity = {
                ...entity,
                ObjectId: id,
                drawKind: entity.drawKind,
            };
            return {
                type,
                ids: [id],
                selectedEntity,
                parameterBounds,
                getCameraValues,
            };
        }
    }

    /** Returns an object that can be used to calculate camera positions that follow the object
     * Supports Edges, curve segments and cylinder      
     * @param object The object being selected.
     * @param selectionPosition Function need the selected position to select a subpart of the object in case it is composed of several parts. 
     * @param setting Settings. 
     * @returns Follow path object that will conain information as well as a function to use for following the parametric object,
     *  undefined if the current picked part is not eligble for follow path
     */
    async followParametricObjectFromPosition(
        id: ObjectId,
        selectionPosition: ReadonlyVec3,
        setting?: MeasureSettings
    ): Promise<FollowParametricObject | undefined> {
        const workerScene = await this.worker;
        const pos = vec3.copy(vec3.create(), selectionPosition);
        const pickedEntity = await workerScene.pickEntity(id, pos);
        if (pickedEntity.entity && pickedEntity.entity.drawKind != "vertex") {
            return this.followParametricEntity(id, pickedEntity.entity, setting);
        }
        return undefined;
    }


    /** Returns an object that can be used to calculate camera posisiotns that follow the objects
     * Supports multiple cylinder,
     * In case of one object, and that object only containing one curve segment it will return curve segment
     * @param ids Set of object ids to follow, can be line segments or cylinders. 
     * @param setting Settings. 
     * @returns Follow path object that will conain information as well as a function to use for following the parametric object,
     *  undefined if there are no objects the can be followed in the ids list
     */
    async followParametricObjects(
        ids: ObjectId[],
        setting?: MeasureSettings
    ): Promise<FollowParametricObject | undefined> {
        const workerScene = await this.worker;
        if (ids.length == 1) {
            const entity = await workerScene.getCurveSegmentEntity(ids[0]);
            if (entity != undefined && entity.drawKind != "vertex") {
                return this.followParametricEntity(ids[0], entity);
            }
        }

        const lineStrip = await workerScene.getLineStripFromCylinders(ids, setting);
        if (lineStrip.length > 1) {
            let len = 0;
            for (let i = 1; i < lineStrip.length; ++i) {
                len += vec3.dist(lineStrip[i - 1], lineStrip[i]);
            }

            const parameterBounds = { start: 0, end: len };
            async function getCameraValues(
                t: number
            ): Promise<CameraValues | undefined> {
                const param =
                    t < 0 ? 0 : t > parameterBounds!.end ? parameterBounds!.end : t;
                let i = 1;
                let length = 0;
                let prevLength = 0;
                let currLength = 0;
                for (; i < lineStrip.length; ++i) {
                    currLength = vec3.dist(lineStrip[i - 1], lineStrip[i]);
                    length += currLength;
                    if (length > param) {
                        break;
                    }
                    prevLength = length;
                }
                if (i == lineStrip.length) {
                    const dir = vec3.subtract(
                        vec3.create(),
                        lineStrip[i - 2],
                        lineStrip[i - 1]
                    );
                    return {
                        position: lineStrip[i - 1],
                        normal: vec3.normalize(dir, dir),
                    };
                }

                const dir = vec3.subtract(
                    vec3.create(),
                    lineStrip[i - 1],
                    lineStrip[i]
                );

                return {
                    position: vec3.lerp(
                        vec3.create(),
                        lineStrip[i - 1],
                        lineStrip[i],
                        (param - prevLength) / currLength
                    ),
                    normal: vec3.normalize(dir, dir),
                };
            }

            return {
                type: lineStrip.length == 2 ? "cylinder" : "cylinders",
                ids,
                selectedEntity: undefined,
                parameterBounds,
                getCameraValues,
            };
        }

        return undefined;
    }
}