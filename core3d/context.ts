import { RenderState, RenderModuleContext, RenderModule, RenderStateOutput } from "./";
import { resizeCanvasToDisplaySize, WebGL2Renderer } from "webgl2";

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
}

// the context is re-created from scratch if the underlying webgl2 context is lost
export class RenderContext {
    private readonly modules: (RenderModuleContext | undefined)[];
    private _prevOutput: RenderStateOutput | undefined;

    // shared mutable state
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
    }

    protected render(state: RenderState) {
        const { renderer } = this;

        // handle resizes
        if (state.output !== this._prevOutput) {
            const { canvas } = renderer;
            const { width, height } = state.output;
            canvas.width = width;
            canvas.height = height;
            this._prevOutput = state.output;
        }

        // set up viewport
        const { width, height } = renderer.canvas;
        renderer.state({
            viewport: { width, height }
        })

        // set up constant buffers (camera, materials)

        // render modules
        for (const module of this.modules) {
            module?.render(state);
        }

        // reset gl state
        renderer.state(null);
    }
}