import type { ReadonlyVec3, ReadonlyMat4 } from "gl-matrix";
import type { downloadScene } from "../scene";

/** Static, streamable geometry render state.
 * @remarks
 * Any change to this state will trigger a complete reload of the streamable scene.
 */
export interface RenderStateScene {
    /** Base url whence the scene was downloaded. */
    readonly url: string;
    /** @internal. */
    readonly config: SceneConfig;
    /** Flags for whether to hide/filter various kinds of geometry. */
    readonly hide?: RenderStateStaticGeometryKinds;
}

/** Axis-aligned bounding box */
export interface AABB {
    /** Minimum coordinates. */
    readonly min: ReadonlyVec3;
    /** Maximum coordinates. */
    readonly max: ReadonlyVec3;
}

/** Bounding sphere */
export interface BoundingSphere {
    /** Sphere center. */
    readonly center: ReadonlyVec3;
    /** Sphere radius. */
    readonly radius: number;
}

/** @internal */
export type Base64String = string;

/** @internal */
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

/** Flags for what types of geometry to render or not. */
export interface RenderStateStaticGeometryKinds {
    /** Whether to render terrain geometry. */
    readonly terrain?: boolean,
    /** Whether to render (non-terrain) triangles. */
    readonly triangles?: boolean,
    /** Whether to render lines. */
    readonly lines?: boolean,
    /** Whether to render point (clouds). */
    readonly points?: boolean,
    /** Whether to render document geometry, e.g. rendered PDF. */
    readonly documents?: boolean,
};

/** @internal */
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
    readonly root: Base64String;
}
