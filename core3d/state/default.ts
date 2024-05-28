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
            wireframe: false,
            showNodeBounds: false,
        },
        grid: {
            enabled: false,
            color1: [.5, .5, .5],
            color2: [1, 1, 1],
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
            on: true,
            enabled: false,
            linearThickness: 0.01,
            minPixelThickness: 3,
            maxPixelThickness: 5,
            relativePointSize: 2,
            hidden: true,
            vertexObjectIdBase: 0x7000_0000, // TODO: Get from some global enum instead?
            lineColor: [4, 4, 4], // bright white (overexposed)
            vertexColor: [0, .5, 0], // green
            plane: [0, 0, 1, 0],
            breakingPointAngleThreshold: 30
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
            on: false,
            enabled: false,
            color: [0, 0, 0],
            outlineObjects: false,
        },
        pick: {
            opacityThreshold: 1,
        },
    };
    return state;
}
