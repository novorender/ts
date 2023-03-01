import { quat, vec3 } from "gl-matrix";
import { type RenderState, TonemappingMode } from ".";

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
            position: vec3.create(),
            rotation: quat.create(),
            fov: 45,
            near: 0.1,
            far: 1000,
        },
        grid: {
            enabled: false,
            color: [2, 2, 2],
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
            defaultHighlight: [
                1, 0, 0, 0, 0,
                0, 1, 0, 0, 0,
                0, 0, 1, 0, 0,
                0, 0, 0, 1, 0,
            ],
            groups: [],
        },
        outlines: {
            nearClipping: {
                enable: false,
                color: [10, 10, 10], // bright white (overexposed)
            }
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
                mode: "on",
                colorGradient: {
                    knots: [
                        { position: -1, color: [1, 0, 0, 1] },
                        { position: -0.5, color: [1, 1, 0, 1] },
                        { position: -0.45, color: [1, 1, 0, 0] },
                        { position: 0.45, color: [1, 1, 0, 0] },
                        { position: 0.5, color: [1, 1, 0, 1] },
                        { position: 1, color: [0, 1, 0, 1] },
                    ],
                }
            },
        }
    };
    return state;
}
