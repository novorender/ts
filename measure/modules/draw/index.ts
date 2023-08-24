import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import type { Camera, ObjectId } from "../../measure_view";

export { DrawModule } from "./module";

/** An entity that can be used in Api.getDrawMeasureEntity, Objects returned from the api with draw kind parameter can be used*/
export interface DrawableEntity {
    /** Object id from the web-gl api*/
    readonly ObjectId?: ObjectId;
    /** Collection of kinds that can be drawn using Api.getDrawMeasureEntity*/
    readonly drawKind: "edge" | "face" | "vertex" | "curveSegment" | "manhole" | "measureResult";
}

/** A hierarcical structure to draw 2d objects */
export interface DrawProduct {
    /** Type of draw prouct */
    readonly kind: "basic" | "manhole" | "measureResult";
    /** Objects to draw */
    readonly objects: DrawObject[];
}


/** An object for 2d drawings, can contain multiple parts */
export interface DrawObject {
    /** Type of draw object */
    readonly kind: "cylinder" | "plane" | "edge" | "curveSegment" | "vertex" | "complex" | "text";
    /** Different parts of the object */
    readonly parts: DrawPart[];
}

/** Hole in a filled  polygon */
export interface DrawVoid {
    /** View space coordinates, in pixel values, empty if the entire part is out of view*/
    vertices2D?: ReadonlyVec2[];
    /** World coordinates*/
    vertices3D: ReadonlyVec3[];
}

/** Information about object to draw for measurement */
export interface DrawPart {
    /** Name of the part */
    readonly name?: string;
    /** Display text of the part,
     * For lines of 2 points it is the length
     * For angles its the angle in degrees
     * For surfaces its a list of list strings. One list for out then for its voids 
     */
    text?: string | string[][];
    /** Type of object to draw */
    readonly drawType: "lines" | "filled" | "vertex" | "curveSegment" | "angle" | "text";
    /** From/to 3d elevation of object, used for cylinder to show slope */
    readonly elevation?: { from: number; to: number; horizontalDisplay: boolean };
    /** Hole in the draw part,  only valid for filled kind*/
    readonly voids?: DrawVoid[];
    /** View space coordinates, in pixel values, empty if the entire part is out of view*/
    vertices2D?: ReadonlyVec2[];
    /** World coordinates*/
    vertices3D: ReadonlyVec3[];
}

/** Draw context for keeping updated canvas widht height and camera properties */
export interface DrawContext {
    /** Pixel width of the render canvas. */
    camera: Camera;
    /** Pixel height of the render canvas.*/
    width: number;
    /** Camera values, RenderStateCamera from core 3d api can be used { @link RenderStateCamera }. */
    height: number;
}