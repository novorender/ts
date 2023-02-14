import { RenderContext } from "./context";
import { ClippingMode, RenderStateClippingPlane, defaultRenderState, modifyRenderState, TonemappingMode, ObjectIdFilter } from "./state";
import { OrbitController } from "./controller";
import { downloadScene } from "./scene";
import { glExtensions } from "@novorender/webgl2";
import { wasmInstance } from "./wasm";
import lut_ggx_png from "./lut_ggx.png";
import { ReadonlyVec3, vec3 } from "gl-matrix";
import { createTestCube, createTestSphere } from "./geometry";
import { loadGLTF } from "./gltf";
import { createColorSetHighlight, createHSLATransformHighlight, createNeutralHighlight } from "./highlight";


export * from "./state";
export * from "./context";
export * from "./module";
export * from "./highlight";

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
    let initPos: ReadonlyVec3 | undefined;
    // sceneId = "933dae7aaad34a35897b59d4ec09c6d7"; // condos_old
    // sceneId = "18f56c98c1e748feb8369a6d32fde9ef"; // condos_new
    // sceneId = "0f762c06a61f4f1c8d3b7cf1b091515e"; // hospital
    // sceneId = "66e8682f73d72066c5daa9f60856d3ce"; // bim_old
    // sceneId = "637dc835036d4bb399b168d386a4b5fa"; // bim_new
    // sceneId = "a8bcb9521ef04db6822d1d93382f9b71"; // banenor
    // initPos = [298995.87220525084, 48.56500795571233, -6699553.125910083];
    sceneId = "6ecdecf66a164c4dbd4dd2c40f1236a7"; // tunnel
    // initPos = [94483.4765625, 73.49801635742188, -1839260.25];
    // sceneId = "d13f81cc86fe46e89985b0f39e6407e2"; // untextured terrain
    const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    const backgroundUrl = new URL("/assets/env/lake/", scriptUrl).toString();
    const sceneUrl = new URL(`/assets/octrees/${sceneId}/`, scriptUrl).toString();
    const scene = sceneId ? await downloadScene(sceneUrl) : undefined;
    const center = initPos ?? scene?.config.center ?? vec3.create();

    // const terrain = {
    //     elevationGradient: {
    //         knots: [
    //             { position: -150, color: [1, 0, 0] },
    //             { position: -100, color: [0, 1, 0] },
    //             { position: -50, color: [0, 0, 1] },
    //             { position: -50, color: [0, 0, 0] },
    //             { position: 500, color: [1, 1, 1] },
    //         ],
    //     },
    //     asBackground: false,
    // } as const;

    // const gltfObjects = await loadGLTF(new URL("/assets/gltf/logo.glb", scriptUrl));
    // const gltfObjects = await loadGLTF(new URL("/assets/gltf/boxtextured.glb", scriptUrl));

    const planes: RenderStateClippingPlane[] = [
        { normalOffset: [1, 0, 0, 0], color: [1, 0, 0, 0.5] },
        { normalOffset: [0, 1, 0, 0], color: [0, 1, 0, 0.5] },
        { normalOffset: [0, 0, 1, 0], color: [0, 0, 1, 0.5] },
    ];

    // const testCube = createTestCube();
    // const testSphere = createTestSphere(1, 5);

    const controller = new OrbitController({ kind: "orbit" }, canvas);

    state = modifyRenderState(state, {
        scene,
        background: { url: backgroundUrl, blur: 0.25 },
        camera: { near: 10, far: 10000 },
        // terrain,
        // camera: { near: 1, far: 10000, position: [298995.87220525084, 48.56500795571233, -6699553.125910083] },
        // grid: { enabled: true, origin: center },
        // cube: { enabled: true },
        // clipping: { enabled: true, draw: true, mode: ClippingMode.intersection, planes },
        // outlines: { nearClipping: { enable: true, } },
        // tonemapping: { mode: TonemappingMode.normal },
        // dynamic: {
        //     objects: gltfObjects,
        //     // objects: [testCube],
        // }
    });

    controller.autoFitToScene(state, center);

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

    function filter() {
        const { scene } = state;
        if (scene) {
            let objectIds = new Array<number>(Math.floor(scene.config.numObjects / 10)).fill(0).map((_, i) => i);
            const filter: ObjectIdFilter = { mode: "include", objectIds: objectIds };
            state = modifyRenderState(state, { scene: { ...scene, filter } });
        }
    }
    // filter();

    let context: RenderContext | undefined;

    const rgbaTransforms = {
        neutral: createNeutralHighlight(),
        red: createColorSetHighlight([1, 0, 0]),
        gray: createHSLATransformHighlight({ saturation: 0 }),
    } as const;

    canvas.addEventListener("click", async (e) => {
        if (context) {
            const samples = await context["pick"](e.offsetX, e.offsetY);
            const centerSample = samples.find(s => s.x == 0 && s.y == 0);
            if (centerSample) {
                const { objectId } = centerSample;
                state = modifyRenderState(state, {
                    highlights: {
                        defaultHighlight: rgbaTransforms.gray,
                        groups: [{ rgbaTransform: rgbaTransforms.red, objectIds: [objectId] }]
                    }
                });
            } else {
                state = modifyRenderState(state, {
                    highlights: {
                        defaultHighlight: rgbaTransforms.neutral,
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
