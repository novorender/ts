import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import type { Camera, ObjectId } from "../../measure_view";

export { DrawModule } from "./module";

export type ElevationInfo = {
    from: number; to: number; horizontalDisplay: boolean, slope?: number
}

/** Setting for drawing lines */
export interface LinesDrawSetting {
    /** If closed is set to true the line enpoints will be joined and the polygon filled */
    closed?: boolean,
    /** Generate angles between each line segment */
    angles?: boolean,
    /** Generate length labels on each line segment in meters */
    generateLengthLabels?: boolean,
    /** Generate slope labels in percentage and and direction arrow on each line segment*/
    generateSlope?: boolean | Set<ObjectId>,
    /** Number of decimals on labels */
    decimals?: number
}


/** An entity that can be used in measureView.draw.getDrawMeasureEntity, Objects returned from the api with draw kind parameter can be used*/
export interface DrawableEntity {
    /** Object id corresponding to he object ids gotten from picking from the core3d api*/
    readonly ObjectId?: ObjectId;
    /** Collection of kinds that can be drawn using measureView.draw.getDrawMeasureEntity*/
    readonly drawKind: "edge" | "face" | "vertex" | "curveSegment" | "manhole" | "measureResult" | "points";
}

/** A hierarcical structure to draw 2d objects */
export interface DrawProduct {
    /** Type of draw product */
    readonly kind: "basic" | "manhole" | "measureResult";
    /** Objects to draw */
    readonly objects: DrawObject[];
    /** Object id of the drawn product*/
    readonly ObjectId?: ObjectId;
}



/** An object for 2d drawings, can contain multiple parts */
export interface DrawObject {
    /** Type of draw object */
    readonly kind: "cylinder" | "plane" | "edge" | "curveSegment" | "vertex" | "complex" | "text" | "unknown";
    /** Different parts of the object */
    readonly parts: DrawPart[];
}

/**
 * Laser interseciton values collected from a single brep face
 */
export interface LaserIntersections {
    kind: "plane" | "cylinder",
    /** Intersection in x direction negative direction first then negative*/
    x: ReadonlyVec3[][],
    /** Intersection in y direction negative direction first then negative*/
    y: ReadonlyVec3[][],
    /** Intersection in z direction negative direction first then negative*/
    z: ReadonlyVec3[][],
    /** X direction of the face*/
    xDirection?: ReadonlyVec3,
    /** Y direction of the face*/
    yDirection?: ReadonlyVec3,
    /** Z direction of the face*/
    zDirection?: ReadonlyVec3,
}


/** Hole in a filled  polygon */
export interface DrawVoid {
    /** View space coordinates, in pixel values, empty if the entire part is out of view*/
    vertices2D?: ReadonlyVec2[];
    /** World coordinates*/
    vertices3D: ReadonlyVec3[];
    /** Indices reffering to vertices3D and text if it is a list, -1 means an added empty text*/
    indicesOnScreen?: number[];
}

export type Line2d = { start: ReadonlyVec2, end: ReadonlyVec2 };

/** Information about object to draw for measurement */
export interface DrawPart {
    /** Name of the part */
    readonly name?: string;
    /** 
     * Display text of the part,
     * For lines of 2 points it is the length
     * For angles its the angle in degrees
     * For surfaces its a list of list strings. First list is for the outer loop while the remaining is for the voids 
     */
    readonly text?: string | string[][];
    /** Type of object to draw */
    readonly drawType: "lines" | "filled" | "vertex" | "curveSegment" | "angle" | "text";
    /** From/to 3d elevation of object, used for cylinder to or lines  to show slope */
    readonly elevation?: ElevationInfo | (ElevationInfo | undefined)[];
    /** Void in the draw part,  only valid for filled kind*/
    readonly voids?: DrawVoid[];
    /** World coordinates*/
    readonly vertices3D: ReadonlyVec3[];

    /** View space coordinates, in pixel values, empty if the entire part is out of view*/
    vertices2D?: ReadonlyVec2[];

    /** Indices reffering to vertices3D and text if it is a list, -1 means an added empty text*/
    indicesOnScreen?: number[];
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