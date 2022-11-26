import { quat, vec3 } from "gl-matrix";
import { createWebGL2Renderer } from "@novorender/webgl2";
import { RenderContext } from "./context";
import { createModules } from "./module";
import { defaultRenderState, modifyRenderState } from "./state";
import { OrbitController } from "./controller";
import { downloadScene } from "./scene";

export * from "./state";
export * from "./context";
export * from "./module";

export async function run(canvas: HTMLCanvasElement) {
    const renderer = createWebGL2Renderer(canvas, {
        alpha: true,
        antialias: false,
        depth: true,
        desynchronized: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
    });

    const controller = new OrbitController({ kind: "orbit" }, canvas);
    let state = defaultRenderState();
    let prevState = state;
    // const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    // const sceneUrl = new URL("/assets/octrees/933dae7aaad34a35897b59d4ec09c6d7_/", scriptUrl).toString();

    //const scene = await downloadScene("/assets/octrees/933dae7aaad34a35897b59d4ec09c6d7_/"); // condos
    const scene = await downloadScene("/assets/octrees/0f762c06a61f4f1c8d3b7cf1b091515e_/"); // hospital

    state = modifyRenderState(state, {
        scene,
        background: { url: "https://api.novorender.com/assets/env/lake/", blur: 0.25 },
        // camera: { back: 10000 },
        grid: { enabled: true },
    });

    controller.autoFitToScene(state);

    function resize() {
        const scale = devicePixelRatio;
        let { width, height } = canvas.getBoundingClientRect();
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const { output } = state;
        if (width != output.width || height != output.height) {
            state = modifyRenderState(state, { output: { width, height } });
        }
    }
    resize();

    // function rotateCamera(time = 0) {
    //     const rotation = quat.fromEuler(quat.create(), -15, time / 100, 0);
    //     const position = vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, 15), rotation);
    //     state = modifyRenderState(state, { camera: { position, rotation } });
    // }
    // rotateCamera();

    const modules = createModules(state);
    const context = new RenderContext(renderer, modules);

    function render(time: number) {
        resize();
        state = controller.updateRenderState(state);
        // rotateCamera(time);
        if (prevState !== state || context.changed) {
            prevState = state;
            context["render"](state);
        }
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    // controller.dispose();
    // renderer.dispose();
}