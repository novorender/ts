import { RenderModuleContext, RenderModule, RenderStateOutput, DerivedRenderState, RenderState, RenderModuleState, RenderStateCamera, CoordSpace, createModules } from "./";
import { createWebGL2Renderer, WebGL2Renderer } from "webgl2";
import { matricesFromRenderState } from "./matrices";
import { createViewFrustum } from "./viewFrustum";
import { createUniformBufferProxy } from "./uniforms";

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
}

// the context is re-created from scratch if the underlying webgl2 context is lost
export class RenderContext {
    private readonly modules: readonly RenderModule[];
    private readonly moduleContexts: (RenderModuleContext | undefined)[];
    private outputState;
    private cameraState;
    private cameraUniformsData;
    readonly renderer: WebGL2Renderer;

    // shared mutable state
    changed = true;
    readonly cameraUniformsBuffer: WebGLBuffer;
    private static defaultModules: readonly RenderModule[] | undefined;
    // iblUniformsBuffer: WebGLBuffer | null = null;

    constructor(canvas: HTMLCanvasElement, options?: WebGLContextAttributes, modules?: readonly RenderModule[]) {
        this.renderer = createWebGL2Renderer(canvas, options);
        this.modules = modules ?? RenderContext.defaultModules ?? RenderContext.defaultModules ?? createModules();
        RenderContext.defaultModules = this.modules;

        this.moduleContexts = this.modules.map((m, i) => {
            const module = m.withContext(this);
            if (!isPromise(module)) {
                return module;
            }
            module.then(m => {
                this.moduleContexts[i] = m;
            });
        });
        this.outputState = new RenderModuleState<RenderStateOutput>();
        this.cameraState = new RenderModuleState<RenderStateCamera>();

        this.cameraUniformsData = createUniformBufferProxy({
            clipViewMatrix: "mat4",
            viewClipMatrix: "mat4",
            worldViewMatrixNormal: "mat3",
            viewWorldMatrixNormal: "mat3",
        });
        this.cameraUniformsBuffer = this.renderer.createBuffer({ kind: "UNIFORM_BUFFER", size: this.cameraUniformsData.buffer.byteLength + 256 });
    }

    protected contextLost() {
        for (const module of this.moduleContexts) {
            module?.contextLost();
        }
    }

    isContextLost() {
        return this.renderer.isContextLost();
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

        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const derivedState = state as Mutable<DerivedRenderState>;
        if (resized || this.cameraState.hasChanged(state.camera)) {
            derivedState.matrices = matricesFromRenderState(state);
            derivedState.viewFrustum = createViewFrustum(state, derivedState.matrices);
        }
        this.updateCameraUniforms(derivedState);

        // set up viewport
        const { width, height } = renderer.canvas;

        // render modules
        for (const module of this.moduleContexts) {
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

    private updateCameraUniforms(state: DerivedRenderState) {
        const { renderer, cameraUniformsData } = this;
        const { matrices } = state;
        const { uniforms } = cameraUniformsData;
        uniforms.clipViewMatrix = matrices.getMatrix(CoordSpace.Clip, CoordSpace.View);
        uniforms.viewClipMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        uniforms.worldViewMatrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
        uniforms.viewWorldMatrixNormal = matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World);
        renderer.update({ kind: "UNIFORM_BUFFER", srcData: this.cameraUniformsData.buffer, targetBuffer: this.cameraUniformsBuffer });
    }
}

