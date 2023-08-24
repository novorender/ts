import type { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";


type Camera = unknown;

interface MeasureAPI {
    readonly orthogonalConstraints: {
        readonly planeXY: PlanarConstraint;
        readonly planeXZ: PlanarConstraint;
        readonly planeYZ: PlanarConstraint;
        readonly axisX: AxialConstraint;
        readonly axisY: AxialConstraint;
        readonly axisZ: AxialConstraint;
    };

    loadObject(id: string): Promise<MeasureObject>;
    visualize(camera: Camera, ...objects: readonly MeasureObject[]): Canvas2DVisualization;

    measureDistance(entities: readonly [MeasureEntity, MeasureEntity], constraint?: SpatialConstraint): DistanceMeasurement;
    measureAngle(entities: readonly [MeasureEntity, MeasureEntity], constraint?: AngluarConstraint): AngleMeasurement;
}

interface MeasureObject {
    readonly faces: readonly MeasureFace[];
    readonly edges: readonly MeasureEdge[];
}

interface DistanceMeasurement {
    readonly kind: "distance";
    readonly entities: readonly [MeasureEntity, MeasureEntity];
    readonly constraint?: SpatialConstraint;
    readonly distance: number;
}

interface AngleMeasurement {
    readonly kind: "angle";
    readonly entities: readonly [MeasureEntity, MeasureEntity];
    readonly constraint?: AngluarConstraint;
    readonly angle: number;
}

type Measurement = DistanceMeasurement | AngleMeasurement;

type DistanceUnit = { kind: "metric"; scale: 1 | 10 | 100 | 1000 | 0.1 | 0.01 | 0.01 | 0.001 }

// this object processes the selected objects once (for a given camera perspectie) to speed up latter path computations
// hidden lines etc will only work for faces within the set of provided objects
// orthographic projection can use Transform2D to dynamically move/rotate/scale paths without having to recompute visualization paths.
interface Canvas2DVisualization {
    readonly camera: Camera; // sync with 3D view camera

    // sync with render settings?
    plane: unknown; // reference plane
    near: number; // near clipping plane distance (relative to reference plane)
    far: number; // far clipping plane distance (relative to reference plane)

    transform: Readonly<DOMMatrix2DInit>; // used to sync 2D transforms with orthographic camera
    renderEntity(entity: MeasureEntity): Path2D; // should cache/reuse if possible
    renderMeasurement(measurement: Measurement, unit?: DistanceUnit): Path2D;
}

declare var m: MeasureAPI;
const o = await m.loadObject("?");
m.measureAngle([o.edges[0], o.edges[1]])


interface LinearConstraint {
    readonly kind: "linear";
    readonly path: Path2D; // for visualization
    readonly plane: {
        readonly origin: ReadonlyVec3;
        readonly direction: ReadonlyVec3;
    }
}

interface PlanarConstraint {
    readonly kind: "planar";
    readonly path: Path2D; // for visualization
    readonly plane: {
        readonly origin: ReadonlyVec3;
        readonly normal: ReadonlyVec3;
    }
}

type SpatialConstraint = LinearConstraint | PlanarConstraint;


interface AxialConstraint {
    readonly kind: "axial";
    readonly path: Path2D; // for visualization
    readonly rotationAxis: ReadonlyVec3;
}

interface PivotalConstraint {
    readonly kind: "pivotal";
    readonly path: Path2D; // for visualization
    readonly pivotPoint: ReadonlyVec3;
    readonly rotationAxis?: ReadonlyVec3;
}


type AngluarConstraint = AxialConstraint | PivotalConstraint;

// use CanvasRenderingContext2D.isPointInPath() to test/select
interface MeasureFace {
    readonly kind: "face";
    readonly visible: Path2D | undefined; // visible portion of face, if any
    readonly hidden: Path2D | undefined; // hidden portion of face, if any
    readonly edges: readonly MeasureEdge[]; // list of associated edges
    readonly area: number;
    readonly validDistanceEntities: readonly [
        "face",
        "edge",
        "vertex"
    ];
    readonly validAngleEntities: readonly [
        "face",
        "edge",
    ]
}


// use CanvasRenderingContext2D.isPointInStroke() to test/select
interface MeasureEdge {
    readonly kind: "edge";
    readonly visible: Path2D | undefined; // visible segments of edge, if any
    readonly hidden: Path2D | undefined; // hidden segments of edge, if any
    readonly faces: readonly [MeasureFace, MeasureFace]; // pair of connected faces
    readonly arcLength: number;
    readonly validDistanceEntities: readonly [
        "face",
        "edge",
        "vertex"
    ];
    readonly validAngleEntities: readonly [
        "face",
        "edge",
    ]
}

// use CanvasRenderingContext2D.isPointInStroke() to test/select
interface MeasureVertex {
    readonly kind: "vertex";
    readonly position2D: ReadonlyVec2;
    readonly position3D: ReadonlyVec3;

    readonly validDistanceEntities: readonly [
        "face",
        "edge",
        "vertex"
    ];
    readonly validAngleEntities: readonly [
    ]
}

type MeasureEntity = MeasureFace | MeasureEdge | MeasureVertex;