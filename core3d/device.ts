
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
    readonly iosShaderBug: boolean; // Older (<A15) IOS devices has a bug when using flat interpolation in complex shaders, which causes Safari to crash after a while.
}