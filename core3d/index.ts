import { quat, vec3 } from "gl-matrix";
import { createWebGL2Renderer } from "@novorender/webgl2";
import { RenderContext } from "./context";
import { createModules } from "./module";
import { defaultRenderState, modifyRenderState } from "./state";

export * from "./state";
export * from "./context";
export * from "./module";

export function run(canvas: HTMLCanvasElement) {
    const renderer = createWebGL2Renderer(canvas, {
        alpha: true,
        antialias: false,
        depth: true,
        desynchronized: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false,
    });

    let state = defaultRenderState();
    let prevState = state;

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

    function rotateCamera(time = 0) {
        const rotation = quat.fromEuler(quat.create(), -15, time / 100, 0);
        const position = vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, 15), rotation);
        state = modifyRenderState(state, { camera: { position, rotation } });
    }
    rotateCamera();

    const modules = createModules(state);
    const context = new RenderContext(renderer, modules);

    function render(time: number) {
        resize();
        rotateCamera(time);
        if (prevState !== state) {
            prevState = state;
            context["render"](state);
        }
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);


    renderer.dispose();
}