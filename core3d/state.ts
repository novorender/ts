import { DrawMode, MagFilterString, MinFilterString, TextureParams2DUncompressed, VertexArrayParams, VertexAttribute, WrapString } from "@novorender/webgl2";
import { quat, vec3, ReadonlyQuat, ReadonlyVec3, ReadonlyVec4, ReadonlyMat4, ReadonlyMat3 } from "gl-matrix";
import { OctreeSceneConfig } from "./scene";

export type RGB = readonly [red: number, green: number, blue: number];
export type RGBA = readonly [red: number, green: number, blue: number, alpha: number];

export type FixedSizeArray<N extends number, T> = N extends 0 ? never[] : { 0: T; length: N; } & ReadonlyArray<T>;

export interface ViewFrustum {
    readonly left: ReadonlyVec4;
    readonly right: ReadonlyVec4;
    readonly top: ReadonlyVec4;
    readonly bottom: ReadonlyVec4;
    readonly near: ReadonlyVec4;
    readonly far: ReadonlyVec4;
    readonly image: ReadonlyVec4; // a plane coincident with camera position and parallel to screen/image plane in world space
    readonly planes: readonly [left: ReadonlyVec4, right: ReadonlyVec4, top: ReadonlyVec4, bottom: ReadonlyVec4, near: ReadonlyVec4, far: ReadonlyVec4];
}

export enum CoordSpace {
    World,
    View,
    Clip,
};

export interface Matrices {
    getMatrix(from: CoordSpace, to: CoordSpace): ReadonlyMat4;
    getMatrixNormal(from: CoordSpace, to: CoordSpace): ReadonlyMat3;
}

export interface RenderStateOutput {
    readonly width: number;
    readonly height: number;
}

export interface RenderStateBackground {
    readonly color?: RGBA;
    readonly url?: string;
    readonly blur?: number;
}

export interface RenderStateCamera {
    readonly kind: "pinhole" | "orthographic";
    readonly position: ReadonlyVec3;
    readonly rotation: ReadonlyQuat;
    readonly fov: number;
    readonly near: number;
    readonly far: number;
}

export interface RenderStateGrid {
    readonly enabled: boolean;
    readonly color: RGB;
    readonly origin: ReadonlyVec3;
    readonly axisX: ReadonlyVec3;
    readonly axisY: ReadonlyVec3;
    readonly size1: number; // minor grid cell size, default = 1
    readonly size2: number; // major grid cell size, default = 10
    readonly distance: number; // max distance to render grid
}

export const CubeId = 0xfffffff8; // object_id for picking

export interface RenderStateCube {
    readonly enabled: boolean; // default = false
    readonly position: ReadonlyVec3; // default = (0,0,0)
    readonly scale: number; // default = 1
    readonly clipDepth: number; // default = 1
}

export interface RenderStateScene {
    readonly url: string;
    readonly config: OctreeSceneConfig;
}

/** Gradient curve knot node. */
export interface RenderStateColorGradientKnot<T extends RGB | RGBA> {
    /** Knot position on the gradient ramp. */
    readonly position: number;
    /** Color to use at this gradient position. */
    readonly color: T;
}

/** A color gradient curve.
 * @remarks
 * This curve is used to visualize some scalar value as a color gradient, e.g. terrain evelvation or point cloud devience.
 */
export interface RenderStateColorGradient<T extends RGB | RGBA> {
    /**A set of knots defining a non-uniform linear spline curve.
     * @remarks
     * Nodes must be sorted in ascending order of elevation!
     * At least two nodes are required for any sort of gradient.
     * Nodes do not have to be uniformly distributed elevation-wise.
     * To create a discontinuity in the gradient, two adjacent nodes with identical elevation, but different colors may be used.
     * Any elevation outside the min/max range defined by this list will be clamped to the color of the nearest node (min or max), i.e., no extrapolation will occur.
     */
    readonly knots: readonly RenderStateColorGradientKnot<T>[];
}

/** Terrain render state. */
export interface RenderStateTerrain {
    /** Elevation gradient color curve.
     * @remarks
     * Elevations are defined as in meters above/below sea level (using negative values for sub sea terrain).
     */
    readonly elevationGradient: RenderStateColorGradient<RGB>;
    /** Flag for whether to draw terrain as background. */
    readonly asBackground: boolean;
};

/** Point cloud settings.
 * @remarks
 * The sizes are cumulative and computed as follows:
 * ``effective_point_pixel_size = max(1, pixelSize + projectedSizeOf(metricSize + tolerance * toleranceFactor))``.
 * Metric size is projected as a 3D sphere at the point origo to deterine pixel size.
 * The term pixel refers to the size of a pixel in the target canvas element, which resolution may differ from that of the render buffer.
 */
export interface RenderStatePointCloud {
    readonly size: {
        /** Point size in pixels. */
        pixel: number | undefined;
        /** Max point size in pixels. */
        maxPixel: number | undefined;
        /** Point size in meters. */
        metric: number | undefined;
        /** The scaling factor for applying the tolerance of the current level of detail to point size.
         * @remarks
         * Different levels of detail (LOD) will have different point densities.
         * Taking this difference into account may result in a more uniform point coverage and visually pleasing result.
         * The tolerance of each LOD reflects the point merging distance threshold in meters used to reduce # points, or 0 for the original level of detail.
         */
        toleranceFactor: number;
    };

    readonly deviation: {
        readonly mode: "on" | "off" | "mix";
        readonly colorGradient: RenderStateColorGradient<RGBA>;
    };
}

export const enum ClippingMode {
    intersection,
    union,
}

export const enum ClippingId { // object_id's for picking
    plane0 = 0xfffffff0, plane1, plane2, plane3, plane4, plane5, plane6
}

export interface RenderStateClippingPlane {
    readonly normalOffset: ReadonlyVec4,
    readonly color?: RGBA;
}

export interface RenderStateClipping {
    readonly enabled: boolean;
    readonly draw: boolean;
    readonly mode: ClippingMode;
    readonly planes: readonly RenderStateClippingPlane[];
}

/** 5x4 row-major matrix for color/opacity transform.
 * @remarks
 * This matrix defines the linear transformation that is applied to the original RGBA color before rendering.
 * The fifth column is multiplied by a constant 1, making it useful for translation.
 * The resulting colors are computed thus:
 * ```
 * output_red = r*m[0] + g*m[1] + b*m[2] + a*m[3] + m[4]
 * output_green = r*m[5] + g*m[6] + b*m[7] + a*m[8] + m[9]
 * output_blue = r*m[10] + g*m[11] + b*m[12] + a*m[13] + m[14]
 * output_alpha = r*m[15] + g*m[16] + b*m[17] + a*m[18] + m[19]
 * ```
 * All input values are between 0 and 1 and output value will be clamped to this range.
 */
export type RGBATransform = FixedSizeArray<20, number>;

export interface RenderStateHighlightGroup {
    readonly rgbaTransform: RGBATransform;
    readonly objectIds: Iterable<number>; // must be sorted in ascending order!
}

export interface RenderStateHighlightGroups {
    readonly defaultHighlight: RGBATransform;
    readonly groups: readonly RenderStateHighlightGroup[];
}

export const enum TonemappingMode {
    color,
    normal,
    depth,
    objectId,
    deviation,
    zbuffer,
};

export interface RenderStateTonemapping {
    /** Camera light exposure as stops of power of 2.
     * @remarks
     * Negative values darkens the image, while positive ones brightens it.
     * The default value is 0.0.
     */
    readonly exposure: number;

    /** Debug display frame buffer */
    readonly mode: TonemappingMode;
}

export interface RenderStateDynamicImage {
    readonly params: TextureParams2DUncompressed; // TODO: Add support for compressed textures
}

export interface RenderStateDynamicSampler {
    readonly minificationFilter?: MinFilterString;
    readonly magnificationFilter?: MagFilterString;
    readonly wrap?: readonly [WrapString, WrapString];
}

export interface RenderStateDynamicTexture {
    readonly image: RenderStateDynamicImage;
    readonly sampler?: RenderStateDynamicSampler;
}

export interface RenderStateDynamicTextureReference {
    readonly texture: RenderStateDynamicTexture;
    readonly texCoord?: 0 | 1; // default: 0
    readonly transform?: ReadonlyMat3; // default: identity matrix
}

export interface RenderStateDynamicNormalTextureReference extends RenderStateDynamicTextureReference {
    readonly scale?: number; // default: 1
}

export interface RenderStateDynamicOcclusionTextureReference extends RenderStateDynamicTextureReference {
    readonly strength?: number; // default: 1
}

export type RenderStateDynamicVertexAttribute = Omit<VertexAttribute, "buffer"> & { readonly buffer: BufferSource };

export interface RenderStateDynamicVertexAttributes {
    readonly position: RenderStateDynamicVertexAttribute;
    readonly normal?: RenderStateDynamicVertexAttribute;
    readonly tangent?: RenderStateDynamicVertexAttribute;
    readonly color0?: RenderStateDynamicVertexAttribute;
    readonly texCoord0?: RenderStateDynamicVertexAttribute;
    readonly texCoord1?: RenderStateDynamicVertexAttribute;
}

export interface RenderStateDynamicGeometry {
    readonly primitiveType: DrawMode;
    readonly attributes: RenderStateDynamicVertexAttributes;
    readonly indices: Uint32Array | Uint16Array | Uint8Array | number;
}

export interface RenderStateDynamicMeshPrimitive {
    readonly geometry: RenderStateDynamicGeometry;
    readonly material: RenderStateDynamicMaterial;
}

export interface RenderStateDynamicMesh {
    readonly primitives: readonly RenderStateDynamicMeshPrimitive[];
}

interface RenderStateDynamicMaterialCommon {
    readonly doubleSided?: boolean; // default: false
    readonly alphaMode?: "OPAQUE" | "MASK" | "BLEND"; // default: "OPAQUE"
    readonly alphaCutoff?: number; // default 0.5
}


export interface RenderStateDynamicMaterialUnlit extends RenderStateDynamicMaterialCommon {
    readonly kind: "unlit";
    readonly baseColorFactor?: RGBA; // default: [1,1,1,1]
    readonly baseColorTexture?: RenderStateDynamicTextureReference;
}

export interface RenderStateDynamicMaterialGGX extends RenderStateDynamicMaterialCommon {
    readonly kind: "ggx";
    readonly baseColorFactor?: RGBA; // default [1,1,1,1]
    readonly metallicFactor?: number; // default: 1
    readonly roughnessFactor?: number; // default: 1
    readonly emissiveFactor?: RGB; // default [0,0,0]
    readonly baseColorTexture?: RenderStateDynamicTextureReference;
    readonly metallicRoughnessTexture?: RenderStateDynamicTextureReference;
    readonly normalTexture?: RenderStateDynamicNormalTextureReference;
    readonly occlusionTexture?: RenderStateDynamicOcclusionTextureReference;
    readonly emissiveTexture?: RenderStateDynamicTextureReference;
    // TODO: include specular, ior and clearcoat?
}

export type RenderStateDynamicMaterial = RenderStateDynamicMaterialUnlit | RenderStateDynamicMaterialGGX;

export interface RenderStateDynamicInstance {
    // parent/children?
    readonly transform: ReadonlyMat4;
    readonly objectId?: number;
}

export interface RenderStateDynamicObject {
    readonly mesh: RenderStateDynamicMesh;
    readonly instance: RenderStateDynamicInstance;
}

export interface RenderStateDynamicObjects {
    readonly objects: readonly RenderStateDynamicObject[];
}

// TODO: Render dynamic geometry
// TODO: make gltf parser generate render state

export interface RenderState {
    readonly output: RenderStateOutput;
    readonly background: RenderStateBackground;
    readonly camera: RenderStateCamera;
    readonly grid: RenderStateGrid;
    readonly cube: RenderStateCube;
    readonly scene: RenderStateScene | undefined;
    readonly terrain: RenderStateTerrain;
    readonly dynamic: RenderStateDynamicObjects;
    readonly clipping: RenderStateClipping;
    readonly highlights: RenderStateHighlightGroups;
    readonly tonemapping: RenderStateTonemapping;
    readonly points: RenderStatePointCloud;
}

export interface DerivedRenderState extends RenderState {
    readonly localSpaceTranslation: ReadonlyVec3; // local space is a variant of world space that is much closer to camera to avoid excessively (for float32) large coordinates in shader
    readonly matrices: Matrices;
    readonly viewFrustum: ViewFrustum;
}

type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
};

export type RenderStateChanges = RecursivePartial<RenderState>;

// this function will create a copy where unchanged properties have same identity (=== operator yields true)
// use this to quickly check for changes.
export function modifyRenderState(state: RenderState, changes: RenderStateChanges): RenderState {
    const newState = mergeRecursive(state, changes) as RenderState;
    if (changes.output) {
        verifyOutputState(newState.output);
    }
    if (changes.clipping) {
        verifyClippingState(newState.clipping);
    }
    return newState;
}

function mergeRecursive(original: any, changes: any) {
    const clone = { ...original };
    for (const key in changes) {
        const originalValue = original ? original[key] : undefined;
        const changedValue = changes[key];
        if (changedValue && typeof changedValue == "object" && !Array.isArray(changedValue)) {
            clone[key] = mergeRecursive(originalValue, changedValue);
        } else {
            clone[key] = changedValue;
        }
    }
    return clone;
}

function verifyOutputState(state: RenderStateOutput) {
    const { width, height } = state;
    if (!Number.isInteger(width) || !Number.isInteger(height))
        throw new Error(`Output size dimentions (width:${width}, height:${height}) must be integers!`);
}

function verifyClippingState(state: RenderStateClipping) {
    const { planes } = state;
    if (planes.length > 6)
        throw new Error(`A maximum of six clippings planes are allowed!`);
}

export function defaultRenderState(): RenderState {
    const state: RenderState = {
        output: {
            width: 512,
            height: 256,
        },
        background: {
        },
        camera: {
            kind: "pinhole",
            position: vec3.create(),
            rotation: quat.create(),
            fov: 45,
            near: 0.1,
            far: 1000,
        },
        grid: {
            enabled: false,
            color: [2, 2, 2],
            origin: [0, 0, 0],
            axisX: [1, 0, 0],
            axisY: [0, 0, 1],
            size1: 1,
            size2: 10,
            distance: 500,
        },
        cube: {
            enabled: false,
            position: [0, 0, 0],
            scale: 1,
            clipDepth: 1,
        },
        scene: undefined,
        terrain: {
            elevationGradient: {
                knots: [
                    { position: -10, color: [0, 0, 0.5] },
                    { position: 0, color: [0.5, 0.5, 1] },
                    { position: 0, color: [0, 0.5, 0] },
                    { position: 10, color: [0.5, 1, 0.5] },
                ],
            },
            asBackground: false,
        },
        dynamic: {
            objects: [],
        },
        clipping: {
            enabled: false,
            draw: false,
            mode: 0,
            planes: [],
        },
        highlights: {
            defaultHighlight: [
                1, 0, 0, 0, 0,
                0, 1, 0, 0, 0,
                0, 0, 1, 0, 0,
                0, 0, 0, 1, 0,
            ],
            groups: [],
        },
        tonemapping: {
            exposure: 0,
            mode: TonemappingMode.color,
        },
        points: {
            size: {
                pixel: 1,
                maxPixel: undefined,
                metric: 0,
                toleranceFactor: 0,
            },
            deviation: {
                mode: "on",
                colorGradient: {
                    knots: [
                        { position: -1, color: [1, 0, 0, 1] },
                        { position: -0.5, color: [1, 1, 0, 1] },
                        { position: -0.45, color: [1, 1, 0, 0] },
                        { position: 0.45, color: [1, 1, 0, 0] },
                        { position: 0.5, color: [1, 1, 0, 1] },
                        { position: 1, color: [0, 1, 0, 1] },
                    ],
                }
            },
        }
    };
    return state;
}
