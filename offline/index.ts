export * from "./serviceWorker";
export * from "./logger";
export type * from "./scene";
export * from "./imports";
export * from "./state";
export * from "./main";

export interface SceneIndex {
    readonly version: "1.0";
    readonly render: {
        readonly webgl2: string;
    }
    readonly offline?: {
        readonly manifest: string;
    }
    readonly measure?: {
        readonly brepLut: string;
    }
    readonly data?: {
        readonly jsonLut: string;
        readonly json: string;
    }
}

