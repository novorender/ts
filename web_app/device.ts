import type { DeviceProfile } from "core3d";
import { View } from "./";

/**
 * GPU performance tier.
 * @remarks
 * This is a rough estimate of the capabilities of a device GPU.
 * 0 is weakest and 3 is strongest.
 * As a general guide, these are the targets for the different tiers:
 * - 0: Unknown GPU - A weak android device. Also the fallback tier for unknown GPUs.
 * - 1: IOS, IPad, high-end android device, weak integrated (intel) GPU
 * - 2: Mac M1 or better, strong integrated GPU or weak/old discrete GPU.
 * - 3: Discrete GPU, mid to high end.
 * @category Device Profile
 */
export type GPUTier = 0 | 1 | 2 | 3; // larger means more powerful GPU

/**
 * Create a device profile.
 * @param tier The performance level of device GPU, 0-3, where 0 is weakest.
 * @param resolutionScaling An optional scale factor to apply to output image resolution.
 * @returns A {@link DeviceProfile} reflecting the typical capabilities of a GPU at given tier level.
 * @remarks
 * A simple tier system is probably too simplistic but provides a starting point.
 * The resulting device profile may be modified further before passing it into the {@link View} constructor.
 * @category Device Profile
 */
export function getDeviceProfile(tier: GPUTier, resolutionScaling?: number): DeviceProfile {
    const outline = tier >= 1;
    let maxGPUBytes = [500_000_000, 750_000_000, 2_000_000_000, 5_000_000_000][tier];
    const maxPrimitives = ([6_000_000, 12_000_000, 20_000_000, 30_000_000] as const)[tier]; // this is not supposed to be used to regulate FPS, but rather avoid rendering taking so long it will crash the browser.
    const maxSamples = ([4, 4, 8, 16] as const)[tier]; // MSAA
    const detailBias = ([0.1, 0.35, 0.75, 1] as const)[tier];
    let renderResolution = ([0.5, 0.75, 1, 1] as const)[tier];
    if (resolutionScaling) {
        renderResolution *= resolutionScaling;
    }

    let adreno600 = false;
    let slowShaderRecompile = false;

    const canvas: HTMLCanvasElement = document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = 1;
    canvas.height = 1;
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    canvas.remove();

    if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = debugInfo
            ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl?.VERSION);
        if (RegExp("Apple GPU").test(renderer)) {
            maxGPUBytes = 500_000_000;
        }
        if (RegExp("Adreno.+6[0-9][0-9]").test(renderer)) {
            adreno600 = true;
        }
        else if (RegExp("Apple M1").test(renderer) || RegExp("Iris").test(renderer)) {
            slowShaderRecompile = true;
        }
    }

    const coreProfile = {
        features: {
            outline,
        },
        limits: {
            maxGPUBytes,
            maxPrimitives,
            maxSamples,
        },
        quirks: {
            adreno600,
            slowShaderRecompile
        },
        detailBias,
    };

    return {
        ...coreProfile,
        renderResolution,
        framerateTarget: 30,
        tier
    } as const;
}
