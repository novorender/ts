import type { DeviceProfile } from ".";
import { RenderContext } from "./context";
import type { Core3DImports } from "./imports";

/**
 * Create and initialize the core 3D render context.
 * @param deviceProfile Details about the device on which we're running.
 * @param canvas The html canvas to render to.
 * @param imports Non-js resource imports.
 * @param setRenderContext A callback function to call whenever the render context changes.
 * @returns A method to explicitly set new device profile (from user input or debugging purposes).
 * This is a relatively low-level API that is aimed at advanced developers only.
 * You should call this method once for each view that you wish to render.
 * It will not return a {@link RenderContext} immediately, since that object is tied to a WebGLRenderingContext, which can be lost and recreated.
 * Instead it will call your setback function, either when the render context is ready or restored.
 * You can check {@link RenderContext.isContextLost} to see if the underlying WebGLRenderingContext is lost or not.
 * Changes to device profile will force a recreation of the entire context and should generally be avoided.
 * @category Render View
 */
export function initCore3D(deviceProfile: DeviceProfile, canvas: HTMLCanvasElement, imports: Core3DImports, setRenderContext: (context: RenderContext) => void) {
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

    let renderContext: RenderContext | undefined;
    let context = { renderContext: undefined as RenderContext | undefined };

    let animId: number | undefined;
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

    async function createContext() {
        renderContext = new RenderContext(deviceProfile, canvas, imports, options);
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
