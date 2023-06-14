import type { ReadonlyVec3, ReadonlyMat4 } from "gl-matrix";

export interface RenderStateScene {
    readonly url: string;
    readonly config: SceneConfig;
    readonly filter?: ObjectIdFilter;
    readonly hide?: RenderStateStaticGeometryKinds;
}

export interface ObjectIdFilter {
    readonly mode: "include" | "exclude";
    /** Sorted (ascending) list of unique object ids to filter. */
    readonly objectIds: Iterable<number>;
};

/** Axis-aligned bounding box */
export interface AABB {
    /** minimum coordinates */
    readonly min: ReadonlyVec3;
    /** maximum coordinates */
    readonly max: ReadonlyVec3;
}

/** Bounding sphere */
export interface BoundingSphere {
    /** Sphere center. */
    readonly center: ReadonlyVec3;
    /** Sphere radius. */
    readonly radius: number;
}

export type Base64String = string;

export interface MaterialProperties {
    readonly diffuse: {
        readonly red: Base64String;
        readonly green: Base64String;
        readonly blue: Base64String;
    };
    readonly opacity: Base64String;
    readonly specular: {
        readonly red: Base64String;
        readonly green: Base64String;
        readonly blue: Base64String;
    };
    readonly shininess: Base64String;
}

export interface RenderStateStaticGeometryKinds {
    readonly terrain?: boolean,
    readonly triangles?: boolean,
    readonly lines?: boolean,
    readonly points?: boolean,
    readonly documents?: boolean,
};

export interface SceneConfig {
    readonly kind: "octree";
    readonly id: string;
    readonly version: string;
    readonly center: ReadonlyVec3;
    readonly offset: ReadonlyVec3;
    readonly scale: number;
    readonly boundingSphere: BoundingSphere; // bounding sphere in model space
    readonly aabb: AABB;
    readonly rootByteSize: number;
    readonly numObjects: number;
    readonly numMaterials: number; // in original mesh, i.e. the size of the materialproperties texture
    readonly materialProperties: MaterialProperties;

    readonly modelWorldMatrix?: ReadonlyMat4; // model -> world space transformation matrix
    readonly subtrees?: ("" | "terrain" | "triangles" | "lines" | "points" | "documents")[];
    readonly variants?: ("deviation" | "intensity")[];
}
