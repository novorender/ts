import { type RenderState, TonemappingMode } from ".";

/** Create a default render state. */
export function defaultRenderState(): RenderState {
    const state: RenderState = {
        output: {
            width: 512,
            height: 256,
            samplesMSAA: 1,
        },
        background: {
        },
        camera: {
            kind: "pinhole",
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            pivot: undefined,
            fov: 45,
            near: 0.1,
            far: 10000,
        },
        quality: {
            detail: 1,
        },
        debug: {
            showNodeBounds: false,
        },
        grid: {
            enabled: false,
            color1: [2, 2, 2],
            color2: [0, 0, 0],
            origin: [0, 0, 0],
            axisX: [1, 0, 0],
            axisY: [0, 0, 1],
            size1: 1,
            size2: 10,
            distance: 500,
        },
        cube: {
            enabled: false,
            position: [0, 0, 0],
            scale: 1,
        },
        scene: undefined,
        terrain: {
            elevationGradient: {
                knots: [
                    { position: -10, color: [0, 0, 0.5] },
                    { position: 0, color: [0.5, 0.5, 1] },
                    { position: 0, color: [0, 0.5, 0] },
                    { position: 10, color: [0.5, 1, 0.5] },
                ],
            },
            asBackground: false,
        },
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
            defaultAction: undefined,
            groups: [],
        },
        outlines: {
            enabled: false,
            color: [10, 10, 10], // bright white (overexposed)
            plane: [0, 0, 1, 0],
        },
        tonemapping: {
            exposure: 0,
            mode: TonemappingMode.color,
        },
        points: {
            size: {
                pixel: 1,
                maxPixel: undefined,
                metric: 0,
                toleranceFactor: 0,
            },
            deviation: {
                index: 0,
                mixFactor: 0,
                colorGradient: {
                    knots: [
                        { position: -1, color: [1, 0, 0, 1] },
                        { position: -0.5, color: [1, 1, 0, 1] },
                        { position: -0.25, color: [0, 1, 0, 1] },
                        { position: 0.25, color: [0, 1, 0, 1] },
                        { position: 0.5, color: [1, 1, 0, 1] },
                        { position: 1, color: [0, 1, 0, 1] },
                    ],
                }
            },
            useProjectedPosition: false
        },
        toonOutline: {
            enabled: false,
            color: [0, 0, 0],
            onlyOnIdleFrame: true,
        },
        pick: {
            opacityThreshold: 1,
        },
    };
    return state;
}
