
export interface DeviceProfile {
    readonly features: DeviceFeatures;
    readonly limits: DeviceLimits;
    readonly quirks: DeviceQuirks;
    /** Texture resolution bias. 0 = full res, 1 = half res */
    readonly textureLOD: 0 | 1;
    /** Geometry detail bias. */
    readonly detailBias: number;
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