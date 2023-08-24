import { type ReadonlyVec3, vec3 } from "gl-matrix";
import type { ParametricEntity } from "../../measure_view";

export { CoreModule } from "./module";

/** MeasurementValues is a collection of values for any measurment */
export type MeasurementValues =
    | EdgeValues
    | FaceValues
    | DuoMeasurementValues;


/** EdgeValues is a collection of values for measurment on a single edge */
export type EdgeValues = LineValues | ArcValues | LineStripValues;

/** LineValues is a collection of values for measuring a single line */
export interface LineValues {
    readonly kind: "line";
    /** Distance from the start to the end of the line */
    readonly distance: Number;
    /** Gradient of the line */
    readonly gradient: vec3;
    /** The start of the line */
    readonly start: vec3;
    /** The end of the line */
    readonly end: vec3;
}

/** ArcValues is a collection of values for measuring a single arc */
export interface ArcValues {
    readonly kind: "arc";
    /** Radius of the arc */
    readonly radius: number;
    /** Angle of the arc segment */
    readonly totalAngle: number;
}

/** LineStripValues is a collection of values for measuring a line strip */
export interface LineStripValues {
    readonly kind: "lineStrip";
    /** Accumulated length of all lines in strip */
    readonly totalLength?: number;
}

/** FaceValues is a collection of values for measurment on a single face */
export type FaceValues = PlaneValues | CylinderValues;

/** PlaneValues is a collection of values for measuring a single Plane */
export interface PlaneValues {
    readonly kind: "plane";
    /** Width of the plane */
    readonly width?: number;
    /** Height of the plane */
    readonly height?: number;
    /** Largest outer radius of the plane in case of only arcs */
    readonly outerRadius?: number;
    /** Largest inner radius of the plane in case of only arcs */
    readonly innerRadius?: number;
    /** Normal of the plane */
    readonly normal: vec3;
    /** Calculated area of the plane */
    readonly area?: number;
    /** Corner vertices of the plane */
    readonly vertices: vec3[];
    /** Outer edges of the plane*/
    readonly outerEdges: EdgeValues[];
    /** Inner edges of the plane*/
    readonly innerEdges: EdgeValues[][];
    /** Y value of the plane origin*/
    readonly heightAboveXyPlane?: number;
    readonly entity: ParametricEntity;
}

/** CylinderValues is a collection of values for measuring a single cylinder */
export interface CylinderValues {
    readonly kind: "cylinder";
    /** Cylinder radius */
    readonly radius: number;
    /** Start of the line going in the center of the cylinder */
    readonly centerLineStart: vec3;
    /** End of the line going in the center of the cylinder */
    readonly centerLineEnd: vec3;
    /** Entity */
    readonly entity: ParametricEntity;
}


/** DuoMeasurementValues is a collection of values for measuring two objects */
export interface DuoMeasurementValues {
    readonly drawKind: "measureResult";
    /** Total distance between the objects */
    readonly distance?: number;
    /** Total normdistance between the objects from object A */
    readonly normalDistance?: number;
    /** Distance on the X plane between the objects */
    readonly distanceX: number;
    /** Distance on the Y plane between the objects */
    readonly distanceY: number;
    /** Distance on the Z plane between the objects */
    readonly distanceZ: number;
    /** Angle between objects, used for cylinders, and the directions*/
    readonly angle?: {
        radians: number, angleDrawInfo: [vec3, vec3, vec3], additionalLine?: [vec3, vec3]
    };
    /** Point to display normal distance between objects from object A */
    readonly normalPoints?: vec3[] | undefined;
    /** information about the first object of calculation */
    readonly measureInfoA?: MeasureObjectInfo,
    /** information about the second object of calculation */
    readonly measureInfoB?: MeasureObjectInfo,
}

export interface MeasureObjectInfo {
    /** Closest point on object */
    readonly point?: vec3;
    /** Parameter on closest point, one if its a curve 2 if its a surface */
    readonly parameter?: number | [number, number]
    /** The valid measurement settings for object*/
    readonly validMeasureSettings?: boolean;
}


/** Tolerance for picking and snapping to parametric objects, numbers are distance in meters */
export interface SnapTolerance {
    segment?: number;
    edge?: number;
    face?: number;
    point?: number;
}

/** Gives values based on selected linestrip*/
export interface LineStripMeasureValues {
    /** The total length of the linestrip */
    readonly totalLength: number;
    /** The input vertices */
    readonly linestrip: ReadonlyVec3[];
    /** List of lenths based on line segments starting with segment between vertex 0 and 1  */
    readonly segmentLengts: number[];
    /** List of angles between line segments starting with angle between segment 0 and 1  */
    readonly angles: number[];
}

/** Load status of the parametric object, uknown means that it have never been fetched and missing means that the object does not have parametric data*/
export type LoadStatus = "loaded" | "unknown" | "missing";
