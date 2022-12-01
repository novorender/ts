import { RenderModuleContext, RenderModule, RenderStateOutput, DerivedRenderState, RenderState, RenderModuleState, RenderStateCamera, CoordSpace, createDefaultModules } from "./";
import { glBuffer, glExtensions, glState, glUpdateBuffer, createUniformBufferProxy, UniformsProxy } from "webgl2";
import { matricesFromRenderState } from "./matrices";
import { createViewFrustum } from "./viewFrustum";
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
    readonly gl: WebGL2RenderingContext;

    // shared mutable state
    changed = true;
    buffers: RenderBuffers = undefined!;
    readonly cameraUniforms: WebGLBuffer;
    // iblUniforms: WebGLBuffer | null = null;

    constructor(readonly canvas: HTMLCanvasElement, options?: WebGLContextAttributes, modules?: readonly RenderModule[]) {
        const gl = canvas.getContext("webgl2", options);
        if (!gl)
            throw new Error("Unable to create WebGL 2 context!");
        this.gl = gl;
        const extensions = glExtensions(gl, true);
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
        this.cameraUniforms = glBuffer(gl, { kind: "UNIFORM_BUFFER", size: this.cameraUniformsData.buffer.byteLength + 256 });
    }

    dispose() {
        const { gl, cameraUniforms, buffers, moduleContexts } = this;
        gl.deleteBuffer(cameraUniforms);
        buffers?.dispose();
        for (const module of moduleContexts) {
            module?.dispose();
        }
        this.deletePick();
    }

    get width() {
        return this.gl.drawingBufferWidth;
    }

    get height() {
        return this.gl.drawingBufferHeight;
    }

    isContextLost() {
        return this.gl.isContextLost();
    }

    updateUniformBuffer(uniformBuffer: WebGLBuffer, proxy: UniformsProxy) {
        if (!proxy.dirtyRange.isEmpty) {
            const { begin, end } = proxy.dirtyRange;
            glUpdateBuffer(this.gl, { kind: "UNIFORM_BUFFER", srcData: proxy.buffer, targetBuffer: uniformBuffer, srcOffset: begin, targetOffset: begin, size: end - begin });
            proxy.dirtyRange.reset();
        }
    }

    protected contextLost() {
        for (const module of this.moduleContexts) {
            module?.contextLost();
        }
    }

    protected poll() {
        this.pollPick();
    }

    protected render(state: RenderState) {
        const { gl, canvas } = this;
        this.changed = false;

        // handle resizes
        let resized = false;
        if (this.outputState.hasChanged(state.output)) {
            const { width, height } = state.output;
            console.assert(Number.isInteger(width) && Number.isInteger(height));
            canvas.width = width;
            canvas.height = height;
            resized = true;
            this.changed = true;
            this.buffers?.dispose();
            this.buffers = new RenderBuffers(gl, width, height);
        }

        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const derivedState = state as Mutable<DerivedRenderState>;
        if (resized || this.cameraState.hasChanged(state.camera)) {
            derivedState.matrices = matricesFromRenderState(state);
            derivedState.viewFrustum = createViewFrustum(state, derivedState.matrices);
        }
        this.updateCameraUniforms(derivedState);
        this.updateUniformBuffer(this.cameraUniforms, this.cameraUniformsData);

        // render modules
        const { width, height } = canvas;
        for (const module of this.moduleContexts) {
            if (module) {
                glState(gl, {
                    viewport: { width, height },
                    frameBuffer: this.buffers.resources.frameBuffer,
                    drawBuffers: ["COLOR_ATTACHMENT0"],
                })
                module.render(derivedState);
                // reset gl state
                glState(gl, null);
            }
        }

        this.buffers.invalidate();
    }

    private updateCameraUniforms(state: DerivedRenderState) {
        const { gl, cameraUniformsData } = this;
        const { matrices } = state;
        const { values } = cameraUniformsData;
        values.clipViewMatrix = matrices.getMatrix(CoordSpace.Clip, CoordSpace.View);
        values.viewClipMatrix = matrices.getMatrix(CoordSpace.View, CoordSpace.Clip);
        values.worldViewMatrixNormal = matrices.getMatrixNormal(CoordSpace.World, CoordSpace.View);
        values.viewWorldMatrixNormal = matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World);
    }

    pickInfo: {
        readonly sync: WebGLSync,
        readonly promises: { readonly resolve: () => void, readonly reject: (reason: string) => void }[],
    } | undefined;

    private pollPick() {
        const { gl, pickInfo } = this;
        if (pickInfo) {
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
        this.gl.deleteSync(this.pickInfo?.sync ?? null);
        this.pickInfo = undefined;
    }

    protected async pick(x: number, y: number): Promise<number[]> {
        const { gl, canvas, buffers, width, height } = this;
        const { resources } = buffers;
        const r = canvas.getBoundingClientRect(); // dim in css pixels
        const cssWidth = r.width;
        const cssHeight = r.height;
        // convert to pixel coords
        const px = Math.round(x / cssWidth * width);
        const py = Math.round((1 - (y + 0.5) / cssHeight) * height);
        console.assert(px >= 0 && py >= 0 && px < width && py < height);
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
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readNormal);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 4, floats, 0, 2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readLinearDepth);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 4, floats, 2, 1);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, resources.readInfo);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, pixOffs * 8, uints, 0, 2);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        return [...floats, uints[0], /* convert pair of half floats for deviation and intensity  */];
    }
}

