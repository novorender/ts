import type { ObjectId } from "../../measure_view";
import type { FaceData } from "../../worker/brep";
import type { CylinderValues, PlaneValues } from "../core";

export { ManholeModule } from "./module"


/** Gives values based on selected manhole, 
   * must contain a top plane, bottom plane an a cylinder running for atleast 50% of the distance between top and bottom 
   * Tesselated manholes will not work */
export interface ManholeMeasureValues {
    /** Can be drawn by Api.getDrawMeasureEntity*/
    readonly drawKind: "manhole";
    /** Object id from the web-gl api*/
    readonly ObjectId: ObjectId;
    /** Plane at the top of the manhole*/
    readonly top: PlaneValues;
    /** Z value of the top plane, center is used if tilted*/
    readonly topElevation: number;
    /** Outer bottom plane of the manhole*/
    readonly bottomOuter: PlaneValues;
    /** Z value of the outer bottom plane, center is used if tilted*/
    readonly bottomOuterElevation: number;
    /** Inner bottom plane, can only be found if circular planes are used, else this is always undefiend*/
    readonly bottomInner?: PlaneValues;
    /** Z value of the inner bottom plane, center is used if tilted*/
    readonly bottomInnerElevation?: number;
    /** Inner cylinder if there are 2 cylinders in the manhole */
    readonly inner?: CylinderValues;
    /** Radius of the inner cylinder */
    readonly innerRadius?: number;
    /** Radius of the outer cylinder, outer will be chosen if only one exists */
    readonly outer: CylinderValues;
    /** Radius of the outer cylinder */
    readonly outerRadius: number;
    /** 
     * @ignore
     * Internal values used for drawing 
    */
    readonly internal: {
        readonly top: FaceData;
        readonly bottomOuter: FaceData;
        readonly bottomInner?: FaceData;
        readonly inner?: FaceData;
        readonly outer: FaceData;
    }
}