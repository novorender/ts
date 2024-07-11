import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";

export type FixedSizeArray<N extends number, T> = N extends 0
    ? never[]
    : {
        // 0: T;
        length: N;
    } & ReadonlyArray<T>;

// brep

export type Index = number;
export type IndexPair = readonly [number, number];

export interface AABB2 {
    readonly min: ReadonlyVec2;
    readonly max: ReadonlyVec2;
}

export interface AABB3 {
    readonly min: ReadonlyVec3;
    readonly max: ReadonlyVec3;
}

export interface Triangulation {
    readonly indices: readonly Index[];
    readonly vertices: readonly number[]; // pairs of uv coords (as in surface parameters). Use surface.eval() to get position, normal, derivatives etc.
}

export interface ProductData {
    readonly version?: string;
    readonly units: string;
    readonly vertices: readonly VertexData[];
    readonly geometries: readonly GeometryData[];
    readonly instances: readonly InstanceData[];
    readonly solids: readonly SolidData[];
    readonly shells: readonly ShellData[];
    readonly faces: readonly FaceData[];
    readonly loops: readonly LoopData[];
    readonly edges: readonly EdgeData[];
    readonly halfEdges: readonly HalfEdgeData[];
    readonly surfaces: readonly SurfaceData[];
    readonly curves3D: readonly Curve3DData[];
    readonly curves2D: readonly Curve2DData[];
    readonly curveSegments: readonly CurveSegmentData[];
    readonly snappingPoints: readonly SnappingPoints[];
}

export interface VertexData {
    position: ReadonlyVec3; // index into shells array
}

export interface InstanceData {
    geometry: Index | string;
    transformation?: FixedSizeArray<number, 16>;
}

export interface GeometryData {
    compoundCurve?: readonly Index[];
    shells?: readonly Index[]; // index into shells array
    solids?: readonly Index[];
    readonly aabb: {
        readonly min: ReadonlyVec3;
        readonly max: ReadonlyVec3;
    };
}

export interface SolidData {
    outerShell: Index; // index into shells array
    innerShells?: readonly Index[]; // indices into shells array
    readonly aabb: {
        readonly min: ReadonlyVec3;
        readonly max: ReadonlyVec3;
    };
}

export interface ShellData {
    readonly faces: readonly Index[]; // indices into faces array
    readonly snappingPoints?: readonly Index[]; // indices into snapping point array
    readonly volume?: number;
}

export interface FaceData {
    readonly surface: Index;
    readonly facing: -1 | 1;
    readonly outerLoop: Index;
    readonly innerLoops?: readonly Index[];
    readonly area: number;
    readonly aabb: AABB3;
    readonly triangulation: Triangulation;
}

export interface LoopData {
    readonly halfEdges: readonly Index[];
}

export interface EdgeData {
    // readonly direction: -1 | 1;
    readonly halfEdges: readonly [Index, Index | null]; // if second index is null, the edge is non-manifold (which is rare/bad)
    readonly curve3D?: Index; // index to curve3D (could be undefined if edge has no extent, i.e. is essentially just a point, e.g. the top of a cone.)
    readonly parameterBounds: readonly [number, number];
    readonly vertices?: IndexPair;
    readonly arcLength: number;
    readonly aabb: AABB3;
    readonly virtual?: true;
    readonly tesselationParameters: readonly number[];
}

export interface CurveSegmentData {
    readonly parameterBounds: readonly [number, number];
    readonly tesselationParameters: readonly number[];
    readonly curve3D: Index;
}

//Used for generated parametric geometry if no face can be made to atleast preserve snapping points
export interface SnappingPoints {
    readonly points: number[];
    readonly aabb: AABB3;
}

export interface HalfEdgeData {
    readonly edge: Index;
    readonly curve2D?: Index;
    readonly parameterBounds: readonly [number, number];
    readonly direction: -1 | 1;
    readonly face: Index;
    readonly faceVertexIndices: readonly Index[]; // indices into triangulated face vertices for this halfedge
    readonly aabb?: AABB2;
}

// surfaces

export interface PlaneData {
    readonly kind: "plane";
    readonly transform: FixedSizeArray<number, 16>; // transformatiom matrix from unit/surface space to object space
    readonly coefficients: FixedSizeArray<number, 4>;
}

export interface CylinderData {
    readonly kind: "cylinder";
    readonly transform: FixedSizeArray<number, 16>; // transformatiom matrix from unit/surface space to object space
    readonly coefficients: FixedSizeArray<number, 10>;
    readonly radius: number;
}

export interface SphereData {
    readonly kind: "sphere";
    readonly transform: FixedSizeArray<number, 16>; // transformatiom matrix from unit/surface space to object space
    readonly coefficients: FixedSizeArray<number, 10>;
    readonly radius: number;
}

export interface TorusData {
    readonly kind: "torus";
    readonly transform: FixedSizeArray<number, 16>; // transformatiom matrix from unit/surface space to object space
    readonly coefficients: number[];
    readonly majorRadius: number;
    readonly minorRadius: number;
}

export interface ConeData {
    readonly kind: "cone";
    readonly transform: FixedSizeArray<number, 16>; // transformatiom matrix from unit/surface space to object space
    readonly coefficients: FixedSizeArray<number, 10>;
    readonly radius: number;
    readonly halfAngleTan: number;
}

export interface NurbsSurfaceData {
    readonly kind: "nurbs";
    readonly orders: [number, number];
    readonly dim: [number, number];
    readonly controlPoints: ReadonlyVec3[];
    readonly knots: number[];
    readonly weights: number[] | undefined;
}

export type SurfaceData = PlaneData | CylinderData | ConeData | SphereData | TorusData | NurbsSurfaceData;

// curves 2D

export interface Line2DData {
    readonly kind: "line";
    readonly origin: ReadonlyVec2;
    readonly direction: ReadonlyVec2;
}

export interface Circle2DData {
    readonly kind: "circle";
    readonly origin: ReadonlyVec2;
    readonly radius: number;
}

export interface Nurbs2DData {
    readonly kind: "nurbs";
    readonly order: number;
    readonly controlPoints: ReadonlyVec2[];
    readonly knots: number[];
    readonly weights: number[] | undefined;
}

export type Curve2DData = Line2DData | Circle2DData | Nurbs2DData;

// curves 3D

export interface LineStrip3DData {
    readonly kind: "lineStrip";
    readonly vertices: ReadonlyVec3[];
}

export interface Line3DData {
    readonly kind: "line";
    readonly origin: ReadonlyVec3;
    readonly direction: ReadonlyVec3;
}

export interface Circle3DData {
    readonly kind: "circle";
    readonly origin: ReadonlyVec3;
    readonly axisX: ReadonlyVec3;
    readonly axisY: ReadonlyVec3;
    readonly radius: number;
}

export interface Nurbs3DData {
    readonly kind: "nurbs";
    readonly order: number;
    readonly controlPoints: ReadonlyVec3[];
    readonly knots: number[];
    readonly weights: number[] | undefined;
}

export type Curve3DData = Line3DData | Circle3DData | Nurbs3DData | LineStrip3DData;
