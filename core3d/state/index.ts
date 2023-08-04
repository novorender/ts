import type { ReadonlyQuat, ReadonlyVec3, ReadonlyVec4, ReadonlyMat4, ReadonlyMat3 } from "gl-matrix";
import type { RGB, RGBA, FixedSizeArray, RecursivePartial } from "./types";
import type { RenderStateScene } from "./scene";
import type { RenderStateDynamicObjects } from "./dynamic";
import type { RenderContext, modifyRenderState } from "../";
export * from "./dynamic";
export * from "./types";
export * from "./scene";
export * from "./default";
export * from "./modify";

/**
 * An object describing the what to be rendered and how by {@link RenderContext.render}.
 * @remarks
 * The render state is immutable by design.
 * You should not attempt to mutate existing objects.
 * The correct way to change render state is to use the {@link modifyRenderState} function.
 * This function will create a new copy of objects with new/modified properties, while retaining all objects that hasn't changed.
 * It will also perform basic validation.
 * The engine uses {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Strict_equality | strict equality} to determine if some portion of the state has changed.
 * Hence, it's important that unchanged sub objects are not copied.
 * 
 * The render state is serializable via JSON or {@link https://developer.mozilla.org/en-US/docs/Web/API/structuredClone | structuredClone()}.
 * This can be useful for test/diagnostics purposes, since the render state should define how the output image eventually is rendered.
 * It may take a while for downloads of streamed resources to complete, however, so the output image will not be fully resolved until all pending downloads are complete.
 * There are also other runtime factors, such as device specific limitations or variations, that may contribute to small deviations in the output image.
 * A direct pixel to pixel comparison between two output images generated by identical render state is thus likely to fail unless it's rendered on the same device and same version of our API, browser, OS and drivers.
 * @category Render State
 */
export interface RenderState {
    /** Output image related state. */
    readonly output: RenderStateOutput;

    /** background/environment related state. */
    readonly background: RenderStateBackground;

    /** camera related state. */
    readonly camera: RenderStateCamera;

    /** Render quality related state. */
    readonly quality: RenderStateQuality;

    /** Grid helper related state. */
    readonly grid: RenderStateGrid;

    /** @internal */
    readonly debug: RenderStateDebug;

    /** @internal. */
    readonly cube: RenderStateCube;

    /** Static, streamable scene related state. */
    readonly scene: RenderStateScene | undefined;

    /** Terrain rendering related state. */
    readonly terrain: RenderStateTerrain;

    /** Dynamic objects related state. */
    readonly dynamic: RenderStateDynamicObjects;

    /** Clipping planes related state. */
    readonly clipping: RenderStateClipping;

    /** Highlights related state. */
    readonly highlights: RenderStateHighlightGroups;

    /** Outlines related state. */
    readonly outlines: RenderStateOutlines;

    /** Tonemapping related state. */
    readonly tonemapping: RenderStateTonemapping;

    /** Point cloud rendering related state. */
    readonly points: RenderStatePointCloud;

    /** Toon outline rendering related state. */
    readonly toonOutline: RenderStateToonOutline;

    /** Pick info rendering related state. */
    readonly pick: RenderStatePick;
}

/** An extended variant of RenderState with additional derived properties.
 * @category Render State
 */
export interface DerivedRenderState extends RenderState {
    /** Local space is a variant of world space that is close to camera to avoid excessively large coordinates and thus float32 rounding errors in shader. */
    readonly localSpaceTranslation: ReadonlyVec3; // 
    /** The set of matrices that used to transform coordinate between spaces. */
    readonly matrices: Matrices;
    /** The 6 planes of the view frustum, defined in world space. */
    readonly viewFrustum: ViewFrustum;
    /** The effective number of MSAA samples uses for this frame.
     * @remarks This originates from {@link RenderStateOutput.samplesMSAA} but is potentially capped to the device's MSAA sample limit.
     */
    readonly effectiveSamplesMSAA: number;
}

/** A partial view of render state used for modifications.
 * @category Render State
 */
export type RenderStateChanges = RecursivePartial<RenderState>;

/** The 6 planes of a {@link https://en.wikipedia.org/wiki/Viewing_frustum | view frustum}, defined in world space.
 * @remarks 
 * Planes are defined as 4D {@link https://en.wikipedia.org/wiki/Half-space_(geometry) | half-space} vectors.
 * Points are inside the halfspace when the dot product of the half-space vector and a 4D variant of the point with w=1 is negative.
 * 
 * `inside = dot(vec4(point, 1.), plane) < 0.;`
 * @category Render State
 */
export interface ViewFrustum {
    /** The left screen edge plane of the frustum */
    readonly left: ReadonlyVec4;
    /** The right screen edge plane of the frustum */
    readonly right: ReadonlyVec4;
    /** The top screen edge plane of the frustum */
    readonly top: ReadonlyVec4;
    /** The bottom screen edge plane of the frustum */
    readonly bottom: ReadonlyVec4;
    /** The camera's near clipping plane. */
    readonly near: ReadonlyVec4;
    /** The camera's far clipping plane. */
    readonly far: ReadonlyVec4;
    /** A plane coincident with camera position and parallel to screen/image plane in world space. */
    readonly image: ReadonlyVec4;
    /** All tuple of all planes used for {@link https://en.wikipedia.org/wiki/Hidden-surface_determination#Viewing-frustum_culling | culling}. */
    readonly planes: readonly [left: ReadonlyVec4, right: ReadonlyVec4, top: ReadonlyVec4, bottom: ReadonlyVec4, near: ReadonlyVec4, far: ReadonlyVec4];
}

/** Transformation coordinate space.
 * @see {@link https://learnopengl.com/Getting-started/Coordinate-Systems}.
 * @category Render State
 */
export enum CoordSpace {
    /** World space. */
    World,
    /** View space. */
    View,
    /** Clip space. */
    Clip,
};

/** A helper object for computing transformation matrices between {@link CoordSpace | spaces} on demand.
 * @category Render State
 */
export interface Matrices {
    /**
     * Return a 4x4 matrix for transforming coordinate from one space to another.
     * @param from The original space.
     * @param to The destination space.
     */
    getMatrix(from: CoordSpace, to: CoordSpace): ReadonlyMat4;

    /**
     * Return a 3X3 matrix for transforming normals from one space to another.
     * @param from The original space.
     * @param to The destination space.
     * @remarks
     * Normals has to be normalized after transformation.
     */
    getMatrixNormal(from: CoordSpace, to: CoordSpace): ReadonlyMat3;
}


/** Output image related state.
 * @category Render State
 */
export interface RenderStateOutput {
    /** Image pixel width. */
    readonly width: number;

    /** Image pixel height. */
    readonly height: number;

    /** Number of {@link https://en.wikipedia.org/wiki/Multisample_anti-aliasing | MSAA} samples used to anti-alias the output image.
     * @remarks
     * This number should be an integer between 1 and 16, inclusive.
     * The more samples, the better the anti aliasing, but also the more memory and render time.
     * Most devices have a max cap on this value, in which case that smaller of the two will be used.
     */
    readonly samplesMSAA: number;
}

/** Background/environment related render state.
 * @category Render State
 */
export interface RenderStateBackground {
    /** The background color to be used if no url is specified.
     * @remarks
     * If undefined, the default background will be used instead.
     * If alpha < 1, the rendered image will be transparent, which could be useful for 2D compositing.
     */
    readonly color?: RGBA;

    /** The url of the background/environment.
     * @remarks
     * This should point to the folder that contains the textures files of the desired environment, e.g. `https://api.novorender/env/lake/'.
     */
    readonly url?: string;

    /** A blur factor to use when rendering the background image.
     * @remarks
     * 0 will yield no blur, while 1 will yield max blur.
     * Blurring is useful for not overly cluttering up the image with backgrounds while still retaining the ambience and lighting characteristics.
     */
    readonly blur?: number;
}

/** Camera related render state.
 * @category Render State
 */
export interface RenderStateCamera {
    /** The type of camera projection to use.
     * @see
     * {@link https://en.wikipedia.org/wiki/Pinhole_camera_model | pinhole}
     * {@link https://en.wikipedia.org/wiki/Orthographic_projection | orthographic}
     */
    readonly kind: "pinhole" | "orthographic";

    /** Camera position in world space. */
    readonly position: ReadonlyVec3;

    /** Camera rotation in world space.
     * @remarks 
     * This rotation is from camera->world space, much like that of a local->world space transformation of any rendered object.
     * It should not be confused with the inverse transformation, i.e. world->camera space, commonly used in shaders.
     */
    readonly rotation: ReadonlyQuat;

    /** Camera pivot point in world space.
     * @remarks 
     * This is used to visualize a point around which the camera will pivot when moved.
     * (Currently not implemented)
     */
    readonly pivot: ReadonlyVec3 | undefined;

    /** Camera's vertical field of view.
     * @remarks
     * For pinhole cameras, this value is interpreted as the angle between the top and bottom edge of the frustum in degrees.
     * For orthographic cameras, this value is interpreted as the distance between the top and bottom edge of the view frustum in meters.
     */
    readonly fov: number;

    /** Camera's near clipping plane distance.
     * @remarks
     * This value must be larger than 0, preferable as large as it can comfortable be without excessive visual clipping artifacts.
     * Any pixels that are closer to the image plane will be clipped.
     * Larger values will greatly improve z-buffer resolution,
     * which helps reduce {@link https://en.wikipedia.org/wiki/Z-fighting | z-fighting}.
     */
    readonly near: number;

    /** Camera's far clipping plane distance.
     * @remarks
     * This value must be larger than the {@link near} clipping plane.
     * Any pixels that are farther away from the image plane will be clipped.
     * Smaller values improves z-buffer resolution, which helps reduce {@link https://en.wikipedia.org/wiki/Z-fighting | z-fighting}.
     * Smaller values also increases the # objects culled, which could help improve rendering performance.
     */
    readonly far: number;
}

/** Quality related render state.
 * @category Render State
 */
export interface RenderStateQuality {
    /**
     * A detail bias factor used to modify the acceptable geometric error, and consequently the amount of geometric detail.
     * @remarks
     * The value must be larger than 0.
     * 1.0 is the baseline value.
     * Lower values will reduce geometric detail, but also improve performance and memory usage.
     * Higher values will increase geometric detail, at the cost of performance and memory consumption.
     * At some point the amount of detail is capped by device specific constraints.
     */
    readonly detail: number;
}

/** @internal */
export interface RenderStateDebug {
    readonly showNodeBounds: boolean;
}

/** Grid related render state.
 * @category Render State
 */
export interface RenderStateGrid {
    /** Turn grid on and off.*/
    readonly enabled: boolean;

    /** Color of minor grid lines.*/
    readonly color1: RGB;

    /** Color of major grid lines.*/
    readonly color2: RGB;

    /** The grid's origin/center coordinate in world space.*/
    readonly origin: ReadonlyVec3;

    /** The grid's x-axis in world space.*/
    readonly axisX: ReadonlyVec3;

    /** The grid's y-axis in world space.*/
    readonly axisY: ReadonlyVec3;

    /** Minor grid cell size
     * @defaultValue 1
     */
    readonly size1: number;

    /** Major grid cell size
     * @defaultValue 10
     */
    readonly size2: number;

    /** Max distance to render grid in meters. */
    readonly distance: number;
}

/** @internal */
export const CubeId = 0xfffffff8; // object_id for picking of cube test object

/** @internal */
export interface RenderStateCube {
    readonly enabled: boolean; // default = false
    readonly position: ReadonlyVec3; // default = (0,0,0)
    readonly scale: number; // default = 1
}

/** Gradient curve knot node.
 * @category Render State
 */
export interface RenderStateColorGradientKnot<T extends RGB | RGBA> {
    /** Knot position on the gradient ramp. */
    readonly position: number;
    /** Color to use at this gradient position. */
    readonly color: T;
}

/** A color gradient curve.
 * @remarks
 * This curve is used to visualize some scalar value as a color gradient, e.g. terrain evelvation or point cloud devience.
 * @category Render State
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

/** Terrain render state.
 * @category Render State
 */
export interface RenderStateTerrain {
    /** Elevation gradient color curve.
     * @remarks
     * Elevations are defined as in meters above/below sea level (using negative values for sub sea terrain).
     */
    readonly elevationGradient: RenderStateColorGradient<RGB>;
    /** Flag for whether to draw terrain as background. */
    readonly asBackground: boolean;
};

/** Point cloud related render state.
 * @remarks
 * The sizes are cumulative and computed as follows:
 * ``effective_point_pixel_size = max(1, pixelSize + projectedSizeOf(metricSize + tolerance * toleranceFactor))``.
 * Metric size is projected as a 3D sphere at the point origo to deterine pixel size.
 * The term pixel refers to the size of a pixel in the target canvas element, which resolution may differ from that of the render buffer.
 * @category Render State
 */
export interface RenderStatePointCloud {
    /** Point size state. */
    readonly size: {
        /** Point size in pixels. */
        readonly pixel: number | undefined;

        /** Max point size in pixels. */
        readonly maxPixel: number | undefined;

        /** Point size in meters. */
        readonly metric: number | undefined;

        /** The scaling factor for applying the tolerance of the current level of detail to point size.
         * @remarks
         * Different levels of detail (LOD) will have different point densities.
         * Taking this difference into account may result in a more uniform point coverage and visually pleasing result.
         * The tolerance of each LOD reflects the point merging distance threshold in meters used to reduce # points, or 0 for the original level of detail.
         */
        readonly toleranceFactor: number;
    };

    /** Point deviation state.
     * @remarks
     * Deviation is pre-computed for some point clouds as a signed, linear distance from the point to some reference/baseline geometry.
     * This is useful to visualize as-built deviances, e.g. in tunnel projects, and whether they are within tolerance and not.
     * Several channels of deviation may be computed.
     * 
     * This state will not have any effect on geometry that does not have pre-computed deviance data baked into it.
     */
    readonly deviation: {
        /** Index of deviation channel (0-3).
         * @remarks
         * This index specifies which deviation channel to currently render on screen and into pick buffers.
         */
        readonly index: number;

        /** Mix factor [0.0, 1.0], where 0 is 100% original vertex color and 1 is 100% color gradient color */
        readonly mixFactor: number;

        /** Color gradient to use for visualizing deviation and tolerances.
         * @remarks May define different gradients for negative and positive numbers.
         */
        readonly colorGradient: RenderStateColorGradient<RGBA>;
    };

    /** Use pre-computed projected point cloud positions instead of original.
     * @remarks This is currently used to render an unwrapped 2D variant of tunnels.
     */
    readonly useProjectedPosition: boolean;
}

/** How to combine the half-spaces of multiple clipping planes into a clipping volume.
 * @category Render State
 */
export enum ClippingMode {
    /** Use the intersection of the clipping plane half-spaces.
     * @remarks
     * This is useful for creating a clipping space where everything outside e.g. a slab or a box is clipped/hidden.
     * 
     * `inside_volume = inside(plane0) AND inside(plane1) AND ...`
     */
    intersection,

    /** Use the union of the clipping plane half-spaces.
     * @remarks
     * This is useful for creating spaces where everything inside e.g. a slab or a box is clipped/hidden.
     * 
     * `inside_volume = inside(plane0) OR inside(plane1) OR ...`
     */
    union,
}

/** Object id/indices for picking of rendered clipping planes.
 * @category Render State
 */
export enum ClippingId {
    plane0 = 0xfffffff0, plane1, plane2, plane3, plane4, plane5, plane6
}

/** Render state for a single clipping plane.
 * @category Render State
 */
export interface RenderStateClippingPlane {
    /** The half-space normal (xyz) and signed offset/distance (w) of the plane. */
    readonly normalOffset: ReadonlyVec4,

    /** The color to use when visualizing the clipping plane, or undefined to not visualize. */
    readonly color?: RGBA,

    /** Geometry outline settings for this clipping plane. */
    readonly outline?: {
        /** Whether to render outlines or not.
         * @remarks
         * Currently, due to limitations in WebGL2,
         * outlines are a costly features that is disabled on weaker devices.
         * Even on more powerful GPUs this feature should be used sparingly.
         */
        enabled: boolean,

        /**
         * The color to use for the outlines of this plane, or undefined to use the {@link RenderStateOutlines.color | default outline color}.
         */
        color?: RGB
    }
}

/** Clipping related render state.
 * @category Render State
 */
export interface RenderStateClipping {
    /** Whether to enable or disable geometry clipping.
     * @remarks
     * Clipping only applies to static/streamble geometry.
     * Enabling clipping comes at a minor cost of rendering performance.
     */
    readonly enabled: boolean;

    /**
     * Whether or not to visualize the clipping planes themselves.
     */
    readonly draw: boolean;

    /** How to combine multiple clipping planes. */
    readonly mode: ClippingMode;

    /** An array of up to 6 clipping planes. */
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
 * @category Render State
 */
export type RGBATransform = FixedSizeArray<20, number>;

/**
 * How to render the geometry of a {@link RenderStateHighlightGroup | highlight group}.
 * @remarks
 * {@link RGBATransform | Color transforms} allows you to modify the color, brightness and transparency of objects within the group.
 * 
 * `"hide"` will hide the objects within the group more effectively than using alpha/opacity = 0,
 *  while still retaining them in memory for quick re-rendering.
 * 
 * `"filter"` will remove the objects from memory entirely, which helps improve rendering performance and memory usage.
 * Unlike hidden group, changes to filtered groups will trigger a complete reload of the streamable scene.
 * @category Render State
 */
export type RenderStateGroupAction = RGBATransform | "hide" | "filter";

/**
 * Render state for a specific highlight group.
 * @remarks
 * Group of objects may be visually highlighted through {@link RGBATransform | color transforms}, hidden or filtered out.
 * @category Render State
 */
export interface RenderStateHighlightGroup {
    /** How to treat this particular group. */
    readonly action: RenderStateGroupAction;
    /** A set of unique object_id belonging to this group, sorted in ascending order. */
    readonly objectIds: Iterable<number>;
}

/**
 * Highlight related render state.
 * @remarks
 * Highlight comes as a modest performance cost.
 * 
 * Group of objects may be visually highlighted through {@link RGBATransform | color transforms}, hidden or filtered out.
 * Currently, a maximum of 250 groups may be defined.
 * Any objects that are not part of a highlight group will be treated according to the {@link defaultAction} property.
 * This could help save memory when "everything else" needs to be hidden or highlighted.
 * 
 * A particular object can only be rendered using a single highlight.
 * If the object id belongs to multiple groups, the last group in the {@link groups} array will determine how it's highlighted.
 * 
 * Hiding a group is more effective than using alpha=0.
 * 
 * Filtering of large group can greatly improve performance and memory consumption.
 * Adding or removing objects to filtered groups will trigger a complete reload of the scene, however.
 * It it thus recommended that this be used for relatively static groups only.
 * @category Render State
 */
export interface RenderStateHighlightGroups {
    /** Highlight action for all objects current not in a highlight group.
     * @defaultValue `undefined`
     */
    readonly defaultAction: RenderStateGroupAction | undefined;

    /** Highlight groups, max 250. */
    readonly groups: readonly RenderStateHighlightGroup[];
}

/** Used to visualize internal render buffers.
 * @defaultValue `TonemappingMode.color`.
 * @category Render State
 */
export enum TonemappingMode {
    /** Render the regular color output using HDR tone-mapping. */
    color,
    /** Visualize the normal buffer. */
    normal,
    /** Visualize the normal buffer. */
    depth,
    /** Visualize the object id/index buffer. */
    objectId,
    /** Visualize the deviation buffer, if any. */
    deviation,
    /** Visualize the z-buffer. */
    zbuffer,
};

/** Outline related render state.
 * @remarks
 * Enabling this feature will render the intersection of geometry surface with the specified plane as lines.
 * This is particularly useful when in orthographic mode on surfaces that are perfectly perpendicular to the image plane.
 * These surfaces would otherwise be invisible and unpickable.
 * 
 * > Due to limitations of WebGL2, outline rendering comes as at potentially significant performance and memory cost.
 * Thus, is may be unavailable on weaker devices and should be used sparingly otherwise.
 * @category Render State
 */
export interface RenderStateOutlines {
    /** Whether to do outline rendering. */
    readonly enabled: boolean;
    /** Color of outline.
     * @remarks
     * Due to {@link RenderStateTonemapping | tone mapping} the color displayed on screen will a bit duller.
     * If you require bright colors, you may "overexpose" them, e.g. `[10,0,0]` for bright red.
     */
    readonly color: RGB;
    /** The outline intersection plane. */
    readonly plane: ReadonlyVec4;
}

/** Tone mapping related render state.
 * @remarks
 * Internally, the output image is rendered in a {@link https://en.wikipedia.org/wiki/High_dynamic_range | HDRI} format.
 * Before it can be displayed onto a regular screen,
 * it needs to be {@link https://en.wikipedia.org/wiki/Tone_mapping tone mapped} and truncated into a displayable format.
 * Currently we use {@link https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl | ACES filmic tone map approximation} for this.
 * @category Render State
 */
export interface RenderStateTonemapping {
    /** Camera light exposure as stops of power of 2.
     * @remarks
     * Negative values darkens the image, while positive ones brightens it.
     * @defaultValue 0.0
     */
    readonly exposure: number;

    /** Debug/diagnostics option to display internal render buffers.
     * @defaultValue TonemappingMode.color
     */
    readonly mode: TonemappingMode;
}

/** Toon shader related outline.
 * @remarks
 * Toon shader is a deliberate misnomer of what is commonly referred to as {@link https://roystan.net/articles/outline-shader/ outline shader}.
 * It is a post-effect that is applied on the output pixels to help visualize geometric edges and contours.
 * Enabling it comes at a potentially significant performance penalty, depending on your device.
 * It should thus be used sparingly, preferably only on idle frames, i.e. while the camera is not moving.
 * @category Render State
 */
export interface RenderStateToonOutline {
    /** Whether to do render "toon" outlines or not. */
    readonly enabled: boolean;
    /** Color to use for edges and contours. */
    readonly color: RGB;
}

/** Pick related render state.
 * @category Render State
 */
export interface RenderStatePick {
    /** The opacity/alpha minimum (inclusive) threshold at which to include a pixel in the pick output.
     * @public
     * @remarks
     * A value between 0 and 1, where 0 includes all pixels no matter how transparent and 1 only includes 100% opaque pixels.
     * The default value is 1.
     */
    readonly opacityThreshold: number;
}