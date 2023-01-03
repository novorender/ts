import { RenderContext } from "./context";
import { ClippingMode, RenderStateClippingPlane, defaultRenderState, modifyRenderState, TonemappingMode } from "./state";
import { OrbitController } from "./controller";
import { downloadScene } from "./scene";
import { glExtensions } from "@novorender/webgl2";
import { wasmInstance } from "./wasm";
import lut_ggx_png from "./lut_ggx.png";
import { vec3 } from "gl-matrix";
import { createTestCube, createTestSphere } from "./geometry";
import { loadGLTF } from "./gltf";


export * from "./state";
export * from "./context";
export * from "./module";

function nextFrame() {
    return new Promise<number>((resolve) => {
        requestAnimationFrame(resolve);
    });
}

export async function run(canvas: HTMLCanvasElement) {
    console.assert(Array.isArray(vec3.create())); // verify that glMatrix.setMatrixArrayType(Array) has been called
    const options: WebGLContextAttributes = {
        alpha: true,
        antialias: false,
        depth: false,
        desynchronized: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
    };

    const wasm = await wasmInstance();

    const blob = new Blob([lut_ggx_png], { type: "image/png" });
    const lut_ggx = await createImageBitmap(blob);

    let state = defaultRenderState();
    let prevState = state;
    let sceneId = "";
    sceneId = "933dae7aaad34a35897b59d4ec09c6d7"; // condos
    // sceneId = "0f762c06a61f4f1c8d3b7cf1b091515e"; // hospital
    // sceneId = "66e8682f73d72066c5daa9f60856d3ce"; // bim
    // sceneId = "a8bcb9521ef04db6822d1d93382f9b71"; // banenor
    const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    const backgroundUrl = new URL("/assets/env/lake/", scriptUrl).toString();
    const sceneUrl = new URL(`/assets/octrees/${sceneId}_/`, scriptUrl).toString();
    const scene = sceneId ? await downloadScene(sceneUrl) : undefined;

    // const gltfObjects = await loadGLTF(new URL("/assets/gltf/logo.glb", scriptUrl));
    // const gltfObjects = await loadGLTF(new URL("/assets/gltf/boxtextured.glb", scriptUrl));

    const planes: RenderStateClippingPlane[] = [
        { normalOffset: [1, 0, 0, 0], color: [1, 0, 0, 0.5] },
        { normalOffset: [0, 1, 0, 0], color: [0, 1, 0, 0.5] },
        { normalOffset: [0, 0, 1, 0], color: [0, 0, 1, 0.5] },
    ];

    // const testCube = createTestCube();
    // const testSphere = createTestSphere(1, 5);

    /*
    Pack vertex attributes more tightly (fill in gaps)
    Use model space xz coords for UV on terrain (fix offset/aabb)
    weighted center/sort triangle by area for z-buffer prepass
    */

    const controller = new OrbitController({ kind: "orbit" }, canvas);
    // const controller = new OrbitController({ kind: "orbit", pivotPoint: [298995.87220525084, 48.56500795571233, -6699553.125910083] }, canvas);

    state = modifyRenderState(state, {
        scene,
        background: { url: backgroundUrl, blur: 0.25 },
        // camera: { near: 1, far: 10000, position: [298995.87220525084, 48.56500795571233, -6699553.125910083] },
        grid: { enabled: true, /* origin: scene.config.boundingSphere.center */ },
        // cube: { enabled: true, clipDepth: 1 },
        // clipping: { enabled: true, draw: true, mode: ClippingMode.intersection, planes },
        // tonemapping: { mode: TonemappingMode.normal },
        // dynamic: {
        //     // objects: gltfObjects,
        //     objects: [testSphere],
        // }
    });

    controller.autoFitToScene(state);

    function resize() {
        // const scale = devicePixelRatio / 2;
        const scale = 1.0;
        let { width, height } = canvas.getBoundingClientRect();
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const { output } = state;
        if (width != output.width || height != output.height) {
            state = modifyRenderState(state, { output: { width, height } });
        }
    }

    let context: RenderContext | undefined;

    const rgbaTransform = [
        0, 0, 0, 0, 1, // red
        0, 0, 0, 0, 0, // green
        0, 0, 0, 0, 0, // blue
        0, 0, 0, 0, 1, // alpha
    ] as const;

    canvas.addEventListener("click", async (e) => {
        if (context) {
            const samples = await context["pick"](e.offsetX, e.offsetY);
            const centerSample = samples.find(s => s.x == 0 && s.y == 0);
            if (centerSample) {
                const { objectId } = centerSample;
                state = modifyRenderState(state, {
                    highlights: {
                        groups: [{ rgbaTransform, objectIds: [objectId] }]
                    }
                });
            } else {
                state = modifyRenderState(state, {
                    highlights: {
                        groups: []
                    }
                });
            }
            console.log(centerSample);
        }
    });

    canvas.addEventListener("webglcontextlost", function (event: WebGLContextEvent) {
        event.preventDefault();
        console.info("WebGL Context lost!");
        if (context) {
            context["contextLost"]();
            context = undefined;
        }
        // trigger a reset of canvas on safari.
        canvas.width = 300;
        canvas.height = 150;
        if (animId !== undefined)
            cancelAnimationFrame(animId);
        animId = undefined;
    } as (event: Event) => void, false);

    canvas.addEventListener("webglcontextrestored", function (event: WebGLContextEvent) {
        console.info("WebGL Context restored!");
        init();
    } as (event: Event) => void, false);


    let animId: number | undefined;
    function init() {
        context = new RenderContext(canvas, wasm, lut_ggx, options);
    }
    init();
    emulateLostContext(context!.gl, canvas);

    for (; ;) {
        const renderTime = await nextFrame();
        resize();
        state = controller.updateRenderState(state);
        if (context && !context.isContextLost()) {
            context["poll"]();
            if (prevState !== state || context.changed) {
                prevState = state;
                context["render"](state);
                // console.log("render");
            }
        }
    }

    // controller.dispose();
    // context.dispose();
}

function emulateLostContext(gl: WebGL2RenderingContext, domElement: HTMLElement) {
    const key = "Backspace";
    let isLost = false;
    const { loseContext } = glExtensions(gl);
    domElement.addEventListener("keydown", (e) => {
        if (e.code == key && !isLost) {
            loseContext?.loseContext();
            isLost = true;
            domElement.addEventListener("keyup", (e) => {
                if (e.code == key && isLost) {
                    loseContext?.restoreContext();
                    isLost = true;
                }
            }, { once: false });
        }
    }, { once: false });
}
