import type { AABB, BoundingSphere } from "core3d";

/** Object render id/index. */
export type ObjectId = number;

/** The Data API context for a scene. */
export interface DataContext {
    /**
     * Get the associated meta data from object id.
     * @param objectIndex The object render id/index.
     * @returns The associated meta data.
     */
    getObjectMetaData(objectIndex: ObjectId): Promise<MetaDataEntry>;

    /**
     * Enumerate all the available metadata in scene.
     * @internal Remove for online implementation?
     */
    allObjectMetaData(): AsyncIterableIterator<MetaDataEntry>;
}


/** Meta data associated with an object. */
export interface MetaDataEntry {
    /** The object render id/index. */
    readonly id: ObjectId;

    /** The path of the object expressed as a hierarchical filesystem-like path string. */
    readonly path: string;

    /** The name of object (typically a GUID from IFC database). */
    readonly name: string;

    /** The type of node. */
    readonly type: NodeType;

    /** The object's bounding volume. */
    readonly bounds: Bounds;

    /** A string dictionary of any additional metadata properties associated with object. */
    readonly properties: readonly [key: string, value: string][];


    // TODO: Do we need the entries below, or should we move them into extended interfaces?

    /** The hierarchical nesting level, if applicable */
    readonly level?: number;

    /** A list of descendant object ids, if applicable. */
    readonly descendants?: ObjectId[];

    /** The description of object (typically from IFC database), if available. */
    readonly description?: string;

    /** The url associated with object, if available. */
    readonly url?: string;
}

/** Bounding volume. */
export interface Bounds {
    /** Axis aligned bounding box. */
    readonly box: AABB;

    /** Bounding Sphere. */
    readonly sphere: BoundingSphere;
}

/** Type of node */
export const enum NodeType {
    /** Node has children. */
    Internal = 0,
    /** Node has no children. */
    Leaf = 1,
}
