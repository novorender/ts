import { RenderModuleContext, RenderModule, RenderStateOutput, DerivedRenderState, RenderState, RenderModuleState, RenderStateCamera, CoordSpace, createDefaultModules } from "./";
import { createWebGL2Renderer, WebGL2Renderer } from "webgl2";
import { matricesFromRenderState } from "./matrices";
import { createViewFrustum } from "./viewFrustum";
import { createUniformBufferProxy } from "./uniforms";
import { RenderBuffers } from "./buffers";

function isPromise<T>(promise: T | Promise<T>): promise is Promise<T> {
    return !!promise && typeof Reflect.get(promise, "then") === "function";
}

// the context is re-created from scratch if the underlying webgl2 context is lost
export class RenderContext {
    private static defaultModules: readonly RenderModule[] | undefined;
    private readonly modules: readonly RenderModule[];
    private readonly moduleContexts: (RenderModuleContext | undefined)[];
    private outputState;
    private cameraState;
    private cameraUniformsData;
    readonly renderer: WebGL2Renderer;

    // shared mutable state
    changed = true;
    buffers: RenderBuffers = undefined!;
    readonly cameraUniformsBuffer: WebGLBuffer;
    // iblUniformsBuffer: WebGLBuffer | null = null;

    constructor(canvas: HTMLCanvasElement, options?: WebGLContextAttributes, modules?: readonly RenderModule[]) {
        const renderer = this.renderer = createWebGL2Renderer(canvas, options);
        const { extensions } = renderer;
        console.assert(extensions.loseContext != null, extensions.multiDraw != null, extensions.colorBufferFloat != null);
        this.modules = modules ?? RenderContext.defaultModules ?? RenderContext.defaultModules ?? createDefaultModules();
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
        this.cameraUniformsBuffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", size: this.cameraUniformsData.buffer.byteLength + 256 });
    }

    dispose() {
        const { renderer, cameraUniformsBuffer, buffers, moduleContexts } = this;
        renderer.deleteBuffer(cameraUniformsBuffer);
        buffers?.dispose();
        for (const module of moduleContexts) {
            module?.dispose();
        }
        this.deletePick();
        renderer.dispose();
    }

    protected contextLost() {
        for (const module of this.moduleContexts) {
            module?.contextLost();
        }
    }

    isContextLost() {
        return this.renderer.isContextLost();
    }

    protected poll() {
        this.pollPick();
        this.renderer.pollPromises();
    }

    protected render(state: RenderState) {
        const { renderer } = this;
        this.changed = false;

        // handle resizes
        let resized = false;
        if (this.outputState.hasChanged(state.output)) {
            const { canvas } = renderer;
            const { width, height } = state.output;
            console.assert(Number.isInteger(width) && Number.isInteger(height));
            canvas.width = width;
            canvas.height = height;
            resized = true;
            this.changed = true;
            this.buffers?.dispose();
            this.buffers = new RenderBuffers(renderer, width, height);
        }

        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const derivedState = state as Mutable<DerivedRenderState>;
        if (resized || this.cameraState.hasChanged(state.camera)) {
            derivedState.matrices = matricesFromRenderState(state);
            derivedState.viewFrustum = createViewFrustum(state, derivedState.matrices);
        }
        this.updateCameraUniforms(derivedState);

        // render modules
        const { width, height } = renderer.canvas;
        const { buffers } = this;
        for (const module of this.moduleContexts) {
            if (module) {
                renderer.state({
                    viewport: { width, height },
                    frameBuffer: buffers.frameBuffer,
                    drawBuffers: ["COLOR_ATTACHMENT0"],
                })
                module.render(derivedState);
                // reset gl state
                renderer.state(null);
            }
        }

        this.buffers.invalidate();
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

    pickInfo: {
        readonly sync: WebGLSync,
        readonly promises: { readonly resolve: () => void, readonly reject: (reason: string) => void }[],
    } | undefined;

    private pollPick() {
        const { pickInfo } = this;
        if (pickInfo) {
            const { gl } = this.renderer;
            const { sync, promises } = pickInfo;
            const status = gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
            if (status == gl.WAIT_FAILED) {
                for (const promise of promises) {
                    promise.reject("Pick failed!");
                }
                this.deletePick();
            } else if (status != gl.TIMEOUT_EXPIRED) {
                for (const promise of promises) {
                    promise.resolve();
                }
                this.deletePick();
            }
        }
    }

    private deletePick() {
        this.renderer.gl.deleteSync(this.pickInfo?.sync ?? null);
        this.pickInfo = undefined;
    }

    protected async pick(x: number, y: number): Promise<number[]> {
        const { renderer, buffers } = this;
        const { gl } = renderer;
        const { width, height } = renderer;
        const r = renderer.canvas.getBoundingClientRect(); // dim in css pixels
        const cssWidth = r.width;
        const cssHeight = r.height;
        // convert to pixel coords
        const px = Math.round(x / cssWidth * width);
        const py = Math.round((1 - (y + 0.5) / cssHeight) * height);
        console.assert(px >= 0 && py >= 0 && px < renderer.width && py < renderer.height);
        if (!this.pickInfo) {
            buffers.read();
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
            this.pickInfo = { sync, promises: [] };
        }
        const { promises } = this.pickInfo;
        const promise = new Promise<void>((resolve, reject) => {
            promises.push({ resolve, reject });
        });
        await promise;

        const pixOffs = px + py * width;
        const floats = new Float32Array(3);
        const uints = new Uint32Array(2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffers.normalRead);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 4, floats, 0, 2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffers.linearDepthRead);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 4, floats, 2, 1);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffers.infoRead);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 8, uints, 0, 2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        return [...floats, uints[0], /* convert pair of half floats for deviation and intensity  */];
    }
}

