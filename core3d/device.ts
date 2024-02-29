import type { GPUTier } from "web_app/device";

/** 
 * Information about current device performance and limitations.
 * @remarks
 * This information is normally not available in the browser for security reasons.
 * Hence, we make a best guess estimate based on known device names, GPU model names, a basic benchmark test.
 * Overestimating may crash the browser, so when in doubt we go with a low estimate.
 * Underestimating will produce fewer details and lower resolution/quality than your device can handle.
 * Knowledgeable users may adjust these settings manually, but should be warned to do so with caution.
 * @category Device Profile
*/
export interface DeviceProfile {
    /** What features should be enabled or disabled on this device. */
    readonly features: DeviceFeatures;

    /** What are the practical resource limitations of this device.
     * @remarks
     * The effectively available resources are affected by other resources used by the browser and other apps.
     * Make sure to put these values well below the nominal/theoretical limits to allow for this.
     */
    readonly limits: DeviceLimits;

    /** What particular quirks/bugs does this device have.
     */
    readonly quirks: DeviceQuirks;

    /** Geometry detail bias.
     * @remarks
     * A value of 1.0 is a reasonable default for mid-end devices and acts as a baseline.
     * Smaller values will produce less geometric details, which may improve rendering performance at the cost of geometric error.
     * Larger values will produce more geometric details, which in turn requires more powerful GPU to keep performance acceptable.
     * The formula is essentially this:
     * `acceptable_geometric_error = geometry_max_error / detailBias`
     */
    readonly detailBias: number;

    /** Render resolution bias.
     * @remarks
     * A value of 1.0 is a reasonable default for mid-end devices and acts as a baseline.
     * Smaller values will reduce resolution, which may improve rendering performance at the cost of less image fidelity.
     * Larger values will increase resolution, which in turn requires more powerful GPU to keep performance acceptable.
     * The formula is essentially this:
     * `effective_resolution = default_resolution * renderResolution`
     */
    readonly renderResolution: number;

    /** Target framerate to aim for on this device.
     * @remarks
     * Most devices can display up to 60 FPS, which is perceived as nice and fluid.
     * However, lower frame rates enables more detail and fidelity.
     * 30 or even 20 frames per second may be acceptable on weak devices.
     * Note that this value is merely a hint for automatic adjustments and does not guarantee the effective framerate.
     */
    readonly framerateTarget: number;

    /** How to render material textures.
     * @remarks
     * Mobile devices may not have enough memory or performance for physically based rendering (PBR).
     * In these cases, we revert to a faster and more basic rendering technique.
     * The weakest devices will only render the average color of the texture.
     */
    readonly materialTextureRendering: "None" | "Basic" | "PBR";

    /** Resolution to use for material textures.
     * @remarks
     * Higher resolutions requires more memory and are more taxing on memory bandwidth/performance.
     * Most mobile devices will not benefit much from higher resolutions as their screens are much smaller than a PC monitor.
     */
    readonly materialTextureResolution: null | 256 | 512 | 1024;

    /** General GPU tier for this device.
     * @remarks
     * 0 is weakest, while higher tiers represent more powerful GPUs.
     * The tier system is a gross simplification of GPU performance estimation and does not allow for device-specific fine tuning.
     * Use as a starting point only.
     */
    readonly tier: GPUTier;
}

/** Feature flags for current device. True = enable.
 * @category Device Profile
 */
export interface DeviceFeatures {
    /** Enable/disable outline rendering. */
    readonly outline: boolean;
}

/** Device hardware limitations.
 * @remarks
 * Note that these limitations should reflect the effective limitations of the browser hosting web app, with room for UI and other app related resources.
 * @category Device Profile
 */
export interface DeviceLimits {
    /** Max. # bytes allowed for GPU resources, such as buffers and textures. */
    readonly maxGPUBytes: number;
    /** Max. render primitives (points, lines and triangles) allowed for each frame. */
    readonly maxPrimitives: number;
    /** Max. # of multisample anti aliasing {@link https://en.wikipedia.org/wiki/Multisample_anti-aliasing | MSAA}.
     * @remarks
     * Should be an integer number, generally between 2 and 16.
     * Higher numbers will give better anti aliasing at the expense of slower rendering and more memory usage.
     * 4 is a reasonable value for most devices.
     * 8 works well on powerful discrete GPUs, such as Nvidia.
     * If this value exceeds the max # samples allowed on this device, the driver will cap it to the lower number.
     */
    readonly maxSamples: number; // MSAA
}

/** Known device specific quirks and bugs that we can work around.
 * @remarks
 * These problems usually stems from buggy native WebGL drivers.
 * Workarounds may involve disabling certain features or not producing certain outputs.
 * @category Device Profile
 */
export interface DeviceQuirks {
    /** Adreno 600 series driver bug. Normals in the picking buffer will be 0 and toon shading will be off. */
    readonly adreno600: boolean;
    /** Older Android webgl drivers struggle to compile large shader programs, even asynchronously. To avoid stuttering, disable aggressive recompile, at the expense of overall render performance. */
    readonly slowShaderRecompile: boolean;
    /** Older IOS/Ipad devices don't implement flat shading for float varyings properly and thus introduces interpolation noise, which needs to be rounded off. */
    readonly iosInterpolationBug: boolean;
}