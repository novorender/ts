import { RenderContext } from "./context";
import { defaultRenderState, modifyRenderState, TonemappingMode } from "./state";
import { OrbitController } from "./controller";
import { downloadScene } from "./scene";
import { glExtensions } from "@novorender/webgl2";
import { wasmInstance } from "./wasm";

export * from "./state";
export * from "./context";
export * from "./module";

export async function run(canvas: HTMLCanvasElement) {
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
    const controller = new OrbitController({ kind: "orbit" }, canvas);
    let state = defaultRenderState();
    let prevState = state;
    // const sceneId = "933dae7aaad34a35897b59d4ec09c6d7"; // condos
    const sceneId = "0f762c06a61f4f1c8d3b7cf1b091515e"; // hospital
    const scriptUrl = (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url;
    const sceneUrl = new URL(`/assets/octrees/${sceneId}_/`, scriptUrl).toString();
    const scene = await downloadScene(sceneUrl);

    state = modifyRenderState(state, {
        scene,
        background: { url: "https://api.novorender.com/assets/env/lake/", blur: 0.25 },
        tonemapping: { mode: TonemappingMode.color },
        camera: { near: 1, far: 1000 },
        grid: { enabled: true, origin: scene.config.boundingSphere.center },
        // grid: { enabled: true },
        // cube: { enabled: true, clipDepth: 10 },
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

    canvas.addEventListener("click", async (e) => {
        if (context) {
            const r = await context["pick"](e.offsetX, e.offsetY);
            console.log(r);
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
        context = new RenderContext(canvas, wasm, options);
        function render(time: number) {
            resize();
            state = controller.updateRenderState(state);
            if (context) {
                if (context.isContextLost())
                    return;
                context["poll"]();
                if (prevState !== state || context.changed) {
                    prevState = state;
                    context["render"](state);
                    // console.log("render");
                }
            }
            animId = requestAnimationFrame(render);
        }
        animId = requestAnimationFrame(render);
        emulateLostContext(context.gl, canvas);
    }

    init();

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
