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

    const scale = devicePixelRatio;
    let { width, height } = canvas.getBoundingClientRect();
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    const state = modifyRenderState(defaultRenderState(), { output: { width, height }, camera: { position: vec3.fromValues(0, 0, 15) } });

    const modules = createModules(state);

    const context = new RenderContext(renderer, modules);
    context["render"](state);
    renderer.dispose();
}