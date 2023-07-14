import type { DeviceProfile } from "core3d";

export type GPUTier = 0 | 1 | 2 | 3; // larger means more powerful GPU
/*
Rough outline of intended tier levels:
tier 0: Unknown GPU - better safe than sorry, or a weak android device.
tier 1: IOS, IPad, high-end android device (e.g. modern Samsung S8 Tablet), weak intergrated (intel) GPU
tier 2: Mac M1 or better, strong integrated GPU or weak/old discrete GPU.
tier 3: Discrete GPU, mid to high end.
*/

// A simple tier system is probably too simplistic. We may want to add info about OS and browser here as well.
export function getDeviceProfile(tier: GPUTier, resolutionScaling?: number): DeviceProfile {
    const outline = tier > 2;
    const maxGPUBytes = ([500_000_000, 750_000_000, 2_000_000_000, 5_000_000_000] as const)[tier];
    const maxPrimitives = ([20_000_000, 20_000_000, 20_000_000, 50_000_000] as const)[tier]; // this is not supposed to be used to regulate FPS, but rather avoid rendering taking so long it will crash the browser.
    const maxSamples = ([4, 4, 8, 16] as const)[tier]; // MSAA
    const detailBias = ([0.4, .50, .75, 1] as const)[tier];
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

// const coreProfile = {
//     features: {
//         outline: true,
//     },
//     limits: {
//         maxGPUBytes: 2_000_000_000,
//         maxPrimitives: 100_000_000,
//         maxSamples: 4, // MSAA
//     },
//     quirks: {
//         iosShaderBug: false, // Older (<A15) IOS devices has a bug when using flat interpolation in complex shaders, which causes Safari to crash after a while. Update: Fixed with WEBGL_provoking_vertex extension!
//     },
//     detailBias: 0.6,
// } as const satisfies DeviceProfile;


// export const deviceProfile = {
//     ...coreProfile,
//     renderResolution: 1,
//     framerateTarget: 30 as number
// } as const;

