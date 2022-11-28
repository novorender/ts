import { quat, vec3 } from "gl-matrix";
import { createWebGL2Renderer, WebGL2Renderer } from "@novorender/webgl2";
import { RenderContext } from "./context";
import { createModules } from "./module";
import { defaultRenderState, modifyRenderState } from "./state";
import { OrbitController } from "./controller";
import { downloadScene } from "./scene";

export * from "./state";
export * from "./context";
export * from "./module";

export async function run(canvas: HTMLCanvasElement) {
    const options: WebGLContextAttributes = {
        alpha: true,
        antialias: false,
        depth: true,
        desynchronized: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
    };

    const controller = new OrbitController({ kind: "orbit" }, canvas);
    let state = defaultRenderState();
    let prevState = state;
    // const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    // const sceneUrl = new URL("/assets/octrees/933dae7aaad34a35897b59d4ec09c6d7_/", scriptUrl).toString();

    // const scene = await downloadScene("/assets/octrees/933dae7aaad34a35897b59d4ec09c6d7_/"); // condos
    const scene = await downloadScene("/assets/octrees/0f762c06a61f4f1c8d3b7cf1b091515e_/"); // hospital

    state = modifyRenderState(state, {
        scene,
        background: { url: "https://api.novorender.com/assets/env/lake/", blur: 0.25 },
        // camera: { back: 10000 },
        // grid: { enabled: true, origin: scene.config.boundingSphere.center, size: 100 },
    });

    controller.autoFitToScene(state);

    function resize() {
        const scale = devicePixelRatio / 2;
        let { width, height } = canvas.getBoundingClientRect();
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const { output } = state;
        if (width != output.width || height != output.height) {
            state = modifyRenderState(state, { output: { width, height } });
        }
    }
    resize();

    let context: RenderContext | undefined;

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
        context = new RenderContext(canvas, options);
        function render(time: number) {
            resize();
            state = controller.updateRenderState(state);
            if (context) {
                if (context.isContextLost())
                    return;
                if (prevState !== state || context.changed) {
                    prevState = state;
                    context["render"](state);
                    console.log("render");
                }
            }
            animId = requestAnimationFrame(render);
        }
        animId = requestAnimationFrame(render);
    }

    init();
    emulateLostContext(context?.renderer!);

    // controller.dispose();
    // renderer.dispose();
}

function emulateLostContext(renderer: WebGL2Renderer) {
    const key = "Backspace";
    window.addEventListener("keydown", (e) => {
        if (e.code == key) {
            renderer.loseContext();
            window.addEventListener("keyup", (e) => {
                if (e.code == key) {
                    renderer.restoreContext();
                }
            }, { once: true });

        }
    }, { once: true });

    // setTimeout(() => {
    //     renderer.loseContext();
    //     setTimeout(() => {
    //         renderer.restoreContext();
    //     }, 1000);
    // }, 3000);
}

