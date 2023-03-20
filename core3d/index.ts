import { RenderContext } from "./context";
import { wasmInstance } from "./wasm";
import lut_ggx_png from "./lut_ggx.png";
import type { DeviceProfile } from "./device";

export * from "./state";
export * from "./context";
export * from "./modules";
export * from "./highlight";
export * from "./device";
export * from "./benchmark";

export async function initCore3D(deviceProfile: DeviceProfile, canvas: HTMLCanvasElement, setRenderContext: (context: RenderContext) => void) {
    const options: WebGLContextAttributes = {
        alpha: true,
        antialias: true,
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
        createContext();
    } as (event: Event) => void, false);


    let animId: number | undefined;
    async function createContext() {
        context = new RenderContext(deviceProfile, canvas, wasm, lut_ggx, options);
        await context.init();
        setRenderContext(context)
    }
    await createContext();
}
