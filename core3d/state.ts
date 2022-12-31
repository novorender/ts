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
    readonly color: RGBA;
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

export interface RenderStateHighlightGroup {
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
    readonly rgbaTransform: FixedSizeArray<20, number>;
    readonly objectIds: Iterable<number>; // must be sorted in ascending order!
}

export interface RenderStateHighlightGroups {
    readonly groups: readonly RenderStateHighlightGroup[];
}

export const enum TonemappingMode {
    color,
    normal,
    depth,
    objectId,
    deviation,
    intensity,
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
    readonly texture: RenderStateDynamicTexture | null;
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
    readonly dynamic: RenderStateDynamicObjects;
    readonly clipping: RenderStateClipping;
    readonly highlights: RenderStateHighlightGroups;
    readonly tonemapping: RenderStateTonemapping;
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
    return mergeRecursive(state, changes) as RenderState;
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

export function defaultRenderState(): RenderState {
    const state: RenderState = {
        output: {
            width: 512,
            height: 256,
        },
        background: {
            color: [0, 0, 0.25, 1],
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
            distance: 100,
        },
        cube: {
            enabled: false,
            position: [0, 0, 0],
            scale: 1,
            clipDepth: 1,
        },
        scene: undefined,
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
            groups: [],
        },
        tonemapping: {
            exposure: 0,
            mode: TonemappingMode.color,
        },
    };
    return state;
}
