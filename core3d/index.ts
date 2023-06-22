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
export * from "./geometry";
export { downloadScene } from "./scene";
export { loadGLTF } from "./gltf";

export function initCore3D(deviceProfile: DeviceProfile, canvas: HTMLCanvasElement, setRenderContext: (context: RenderContext) => void) {
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

    const wasmPromise = wasmInstance();
    const blob = new Blob([lut_ggx_png], { type: "image/png" });
    const lut_ggxPromise = createImageBitmap(blob);
    let renderContext: RenderContext | undefined;
    let context = { renderContext: undefined as RenderContext | undefined };

    canvas.addEventListener("webglcontextlost", function (event: WebGLContextEvent) {
        event.preventDefault();
        console.info("WebGL Context lost!");
        if (renderContext) {
            renderContext["contextLost"]();
            context.renderContext = undefined;
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
        const wasm = await wasmPromise;
        const lut_ggx = await lut_ggxPromise;
        renderContext = new RenderContext(deviceProfile, canvas, wasm, lut_ggx, options);
        await renderContext.init();
        setRenderContext(renderContext);
    }
    createContext();

    // return a method to update device profile and recreate renderContext
    return async (value: DeviceProfile) => {
        deviceProfile = value;
        await createContext();
    }
}


