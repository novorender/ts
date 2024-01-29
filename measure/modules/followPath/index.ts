import type { ReadonlyVec3 } from "gl-matrix";
import type { MeasureEntity, ObjectId } from "../../measure_view";

export { FollowModule } from "./module";

/** Parameter bounds */
export interface ParameterBounds {
    /** Start of parameter */
    readonly start: number;
    /** End of parameter*/
    readonly end: number;
}

/** Gives values to create a camera based on selected object */
export interface CameraValues {
    /** Normalized direction */
    normal: ReadonlyVec3;
    /** World position */
    position: ReadonlyVec3;
}


/** Used to get camera values along a curve segment or cylinder center */
export interface FollowParametricObject {
    /** Type of object that is being followed */
    readonly type: "edge" | "curve" | "cylinder" | "cylinders";
    /** Collection of Object Ids, if multiple then it must be following cylinders*/
    readonly ids: ObjectId[];
    /** Information about the entity, used to avoid finding the objects in api functions*/
    readonly selectedEntity: MeasureEntity | undefined;
    /** 
     * Start and stop bounds of the followed object, 
     * unless the parametric object specify otherwise start will be 0 and end will be the length of all segments
     */
    readonly parameterBounds: ParameterBounds;
    /** @internal */
    readonly emulatedCurve?: { start: ReadonlyVec3; dir: ReadonlyVec3 } | undefined;
    /** @internal */
    readonly lineStrip?: ReadonlyVec3[];
}
