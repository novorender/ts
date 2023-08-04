import type { DerivedRenderState } from "../state";
import type { RenderContext } from "../context";

/** A render module factory object.
 * @remarks
 * The render module should be able to gracefully recreate its context from a new render context whenever a lost GL context is restored.
 * @category Render Module
 */
export interface RenderModule {
    /** Human readable name of module. */
    readonly kind: string;

    /** Create a new instance for a given render context. */
    withContext(context: RenderContext): RenderModuleContext | Promise<RenderModuleContext>;
}

/** A render module's context for a specific render context.
 * @remarks This object should contain all GPU/render context specific resources and handle actual updates and rendering.
 * @category Render Module
 */
export interface RenderModuleContext {
    /** Associated render module. */
    readonly module: RenderModule;

    /**
     * Update module specific GPU state, such as uniform buffers.
     * @param state The current frame render state.
     */
    update(state: DerivedRenderState): void;

    /**
     * Do a preliminary render pass to fill in Z-buffer for GPUs where this is beneficial.
     * @param state The current frame render state.
     */
    readonly prepass?: (state: DerivedRenderState) => void;

    /**
     * Render into pick buffers with module specific data.
     * @param state The current frame render state.
     */
    readonly pick?: (state: DerivedRenderState) => void;

    /**
     * Render into color and depth buffer.
     * @param state The current frame render state.
     */
    render(state: DerivedRenderState): void;

    /** Handle loss of underlying WebGLContext, e.g. by cancelling pending downloads. */
    contextLost(): void;

    /** Dispose of all GPU resources. */
    dispose(): void;
}
