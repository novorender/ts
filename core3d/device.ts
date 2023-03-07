
export interface DeviceProfile {
    /** Device type name. */
    readonly name: string;
    readonly samplesMSAA: number;
    readonly feature: DeviceFeatures;
    /** Texture resolution bias. */
    readonly textureResolution: number;
    /** Geometry detail bias. */
    readonly detailBias: number;
    /** Hard limit of gpu memory usage for static geometry. */
    readonly gpuBytesLimit: number;
    /** Hard limit of # triangles for static geometry. */
    readonly triangleLimit: number;
}

export interface DeviceFeatures {
    readonly outline: boolean;
}
