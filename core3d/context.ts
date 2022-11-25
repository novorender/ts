import { RenderModuleContext, RenderModule, RenderStateOutput, DerivedRenderState, RenderState, RenderModuleState, RenderStateCamera, DerivedMutableRenderState } from "./";
import { WebGL2Renderer } from "webgl2";
import { Matrices } from "./matrices";

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
}

// the context is re-created from scratch if the underlying webgl2 context is lost
export class RenderContext {
    private readonly modules: (RenderModuleContext | undefined)[];
    private outputState;
    private cameraState;

    // shared mutable state
    changed = true;
    cameraUniformsBuffer: WebGLBuffer | null = null;
    iblUniformsBuffer: WebGLBuffer | null = null;

    constructor(readonly renderer: WebGL2Renderer, modules: readonly RenderModule[]) {
        this.modules = modules.map((m, i) => {
            const module = m.withContext(this);
            if (!isPromise(module)) {
                return module;
            }
            module.then(m => {
                this.modules[i] = m;
            });
        });
        this.outputState = new RenderModuleState<RenderStateOutput>();
        this.cameraState = new RenderModuleState<RenderStateCamera>();
    }

    protected render(state: RenderState) {
        const { renderer } = this;
        this.changed = false;

        // handle resizes
        let resized = false;
        if (this.outputState.hasChanged(state.output)) {
            const { canvas } = renderer;
            const { width, height } = state.output;
            canvas.width = width;
            canvas.height = height;
            resized = true;
            this.changed = true;
        }

        const derivedState = state as DerivedRenderState;
        if (resized || this.cameraState.hasChanged(state.camera)) {
            (derivedState as DerivedMutableRenderState).matrices = Matrices.fromRenderState(state);
        }

        // set up viewport
        const { width, height } = renderer.canvas;

        // render modules
        for (const module of this.modules) {
            renderer.state({
                viewport: { width, height }
            })
            module?.render(derivedState);
            // reset gl state
            renderer.state(null);
        }

        // reset gl state
        // renderer.state(null);
    }
}