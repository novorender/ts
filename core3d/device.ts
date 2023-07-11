
export interface DeviceProfile {
    readonly features: DeviceFeatures;
    readonly limits: DeviceLimits;
    readonly quirks: DeviceQuirks;
    /** Geometry detail bias. */
    readonly detailBias: number;
    readonly renderResolution: number;
    readonly framerateTarget: number;
}

export interface DeviceFeatures {
    readonly outline: boolean;
}

export interface DeviceLimits {
    readonly maxGPUBytes: number;
    readonly maxPrimitives: number;
    readonly maxSamples: number; // MSAA
}

export interface DeviceQuirks {
    readonly adreno600: boolean; //Packing of 2 32 bit floats to unit os broken on andreno 600 series, normals in the picking buffer will be 0. Conversion from 32 bit uint to 32float does also not work so toonshading will be off. 
    readonly slowShaderRecompile: boolean; //Disable agressive recomplie of shaders on devices where it is slow.
}