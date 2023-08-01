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

/**
 * Create and initialize the core 3D render context.
 * @param deviceProfile Details about the device on which we're running.
 * @param canvas The html canvas to render to.
 * @param setRenderContext A callback function to call whenever the render context changes.
 * @returns A method to explicitly set new device profile (from user input or debugging purposes).
 * This is a relatively low-level API that is aimed at advanced developers only.
 * You should call this method once for each view that you wish to render.
 * It will not return a {@link RenderContext} immediately, since that object is tied to a WebGLRenderingContext, which can be lost and recreated.
 * Instead it will call your setback function, either when the render context is ready or restored.
 * You can check {@link RenderContext.isContextLost} to see if the underlying WebGLRenderingContext is lost or not.
 * Changes to device profile will force a recreation of the entire context and should generally be avoided.
 */
export function initCore3D(deviceProfile: DeviceProfile, canvas: HTMLCanvasElement, setRenderContext: (context: RenderContext) => void) {
    const options: WebGLContextAttributes = {
        alpha: true,
        antialias: true,
        depth: false,
        desynchronized: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
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
            renderContext.contextLost();
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


