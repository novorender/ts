import type { BlitParams, BufferParams, ClearParams, CopyParams, DrawParams, FrameBufferParams, ProgramParams, ReadPixelsParams, RenderBufferParams, SamplerParams, StateParams, TextureParams, VertexArrayParams, Pixels, InvalidateFrameBufferParams, UpdateParams, TransformFeedbackParams, TransformFeedbackTestParams, State } from "./types";
import { createContext, getLimits, LimitsGL, RendererContext, WebGLLoseContextExt, WebGLMultiDrawExt } from "./context.js";
import { createTimer, Timer } from "./timer.js";
import { blit } from "./blit.js";
import { createProgram } from "./program.js";
import { createBuffer } from "./buffer.js";
import { createVertexArray } from "./vao.js";
import { createSampler } from "./sampler.js";
import { createTexture } from "./texture.js";
import { createRenderBuffer } from "./renderBuffer.js";
import { createFrameBuffer, invalidateFrameBuffer } from "./frameBuffer.js";
import { clear } from "./clear.js";
import { copy } from "./copy.js";
import { update } from "./update.js";
import { draw } from "./draw.js";
import { createDefaultState, setState } from "./state.js";
import { readPixelsAsync } from "./read.js";
import { beginTransformFeedback, createTransformFeedback, endTransformFeedback } from "./transformFeedback.js";
export type { RendererContext };
export * from "./types";
export { resizeCanvasToDisplaySize, getUniformLocations } from "./util.js";

export function createWebGL2Renderer(canvas: HTMLCanvasElement, options?: WebGLContextAttributes): WebGL2Renderer {
    const gl = canvas.getContext("webgl2", options);
    if (!gl)
        throw new Error("Unable to create WebGL 2 context!");

    return new WebGL2Renderer(gl, canvas);
}

export class WebGL2Renderer {
    readonly gl: WebGL2RenderingContext;
    readonly limits: LimitsGL;
    readonly extensions: {
        readonly loseContext: WebGLLoseContextExt | null;
        readonly multiDraw: WebGLMultiDrawExt | null;
    }
    readonly defaultState: State;

    private readonly promises: PolledPromise[] = [];
    private timer: Timer | undefined;
    private animFrameHandle: number | undefined;

    constructor(gl: WebGL2RenderingContext, readonly canvas: HTMLCanvasElement) {
        this.gl = gl;
        this.limits = getLimits(gl);
        this.defaultState = createDefaultState(this.limits);
        this.extensions = {
            loseContext: gl.getExtension("WEBGL_lose_context") as WebGLLoseContextExt,
            multiDraw: gl.getExtension("WEBGL_MULTI_DRAW") as WebGLMultiDrawExt,
        } as const;
    }

    dispose() {
        if (this.animFrameHandle !== undefined) {
            cancelAnimationFrame(this.animFrameHandle);
            this.animFrameHandle = undefined;
        }
        this.state(this.defaultState); // make sure resources are unbound before deleting them.
        for (const promise of this.promises) {
            promise.dispose();
        }
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

    loseContext() {
        this.extensions.loseContext?.loseContext();
    }

    restoreContext() {
        this.extensions.loseContext?.restoreContext();
    }

    pollPromises() {
        const promises = this.promises;
        for (let i = 0; i < promises.length; i++) {
            const promise = promises[i];
            if (promise.poll()) {
                promises.splice(i--, 1);
            }
        }
        return promises.length > 0;
    }

    flush() {
        this.gl.flush();
    }

    async nextFrame() {
        const promise = new Promise<number>(resolve => {
            this.animFrameHandle = requestAnimationFrame(time => {
                this.animFrameHandle = undefined;
                resolve(time);
            })
        });
        const time = await promise;
        this.pollPromises();
        return time;
    }

    measureBegin() {
        const timer = createTimer(this.gl);
        this.timer = timer;
        timer.begin();
    }

    measureEnd(): Promise<number> {
        const timer = this.timer!;
        timer.end();
        this.timer = undefined;
        this.promises.push(timer);
        return timer.promise;
    }

    createProgram(params: ProgramParams): WebGLProgram {
        return createProgram(this, params);
    }

    deleteProgram(program: WebGLProgram) {
        this.gl.deleteProgram(program);
    }

    createBuffer(params: BufferParams) {
        return createBuffer(this, params);
    }

    deleteBuffer(buffer: WebGLBuffer) {
        this.gl.deleteBuffer(buffer);
    }

    createVertexArray(params: VertexArrayParams): WebGLVertexArrayObject {
        return createVertexArray(this, params);
    }

    deleteVertexArray(vao: WebGLVertexArrayObject) {
        this.gl.deleteVertexArray(vao);
    }

    createSampler(params: SamplerParams): WebGLSampler {
        return createSampler(this, params);
    }

    deleteSampler(sampler: WebGLSampler) {
        this.gl.deleteSampler(sampler);
    }

    createTexture(params: TextureParams): WebGLTexture {
        return createTexture(this, params);
    }

    deleteTexture(texture: WebGLTexture) {
        this.gl.deleteTexture(texture);
    }

    createRenderBuffer(params: RenderBufferParams): WebGLRenderbuffer {
        return createRenderBuffer(this, params);
    }

    deleteRenderBuffer(rb: WebGLRenderbuffer) {
        const { gl } = this;
        gl.deleteRenderbuffer(rb);
    }

    createFrameBuffer(params: FrameBufferParams): WebGLFramebuffer {
        return createFrameBuffer(this, params);
    }

    invalidateFrameBuffer(params: InvalidateFrameBufferParams) {
        invalidateFrameBuffer(this, params);
    }

    deleteFrameBuffer(fb: WebGLFramebuffer) {
        this.gl.deleteFramebuffer(fb);
    }

    createTransformFeedback(): WebGLTransformFeedback {
        return createTransformFeedback(this);
    }

    deleteTransformFeedback(tf: WebGLTransformFeedback): void {
        this.gl.deleteTransformFeedback(tf);
    }

    beginTransformFeedback(tf: WebGLTransformFeedback, params: TransformFeedbackParams): void {
        beginTransformFeedback(this, tf, params);
    }

    pauseTransformFeedback(): void {
        this.gl.pauseTransformFeedback();
    }

    resumeTransformFeedback(tf: WebGLTransformFeedback): void {
        this.gl.resumeTransformFeedback();
    }

    endTransformFeedback(params?: TransformFeedbackTestParams): void {
        endTransformFeedback(this, params);
    }

    state(params: StateParams | null) {
        setState(this, params ?? this.defaultState);
    }

    clear(params: ClearParams) {
        clear(this, params);
    }

    blit(params: BlitParams) {
        blit(this, params);
    }

    readPixels(params: ReadPixelsParams): Promise<Pixels> {
        const result = readPixelsAsync(this, params);
        this.promises.push(result);
        return result.promise;
    }

    copy(params: CopyParams) {
        copy(this, params);
    }

    update(params: UpdateParams) {
        update(this, params);
    }

    draw(params: DrawParams) {
        draw(this, params);
    }

    checkStatus(message: string = "GL") {
        const { gl } = this;
        const status = gl.getError();
        switch (status) {
            case gl.NO_ERROR: break;
            case gl.INVALID_ENUM:
                throw `${message}: Invalid enum!`;
            case gl.INVALID_VALUE:
                throw `${message}: Invalid value!`;
            case gl.INVALID_OPERATION:
                throw `${message}: Invalid operation!`;
            case gl.INVALID_FRAMEBUFFER_OPERATION:
                throw `${message}: Invalid framebuffer operation!`;
            case gl.OUT_OF_MEMORY:
                throw `${message}: Out of memory!`;
            case gl.CONTEXT_LOST_WEBGL:
                throw `${message}: Context lost!`;
            default:
                throw `${message}: Unknown status!`;
        }
    }
}

export interface PolledPromise<T = any> {
    promise: Promise<T>;
    poll(): boolean;
    dispose(): void;
};

// async function nextFrame(): Promise<number> {
//     return new Promise<number>(resolve => {
//         const handle = requestAnimationFrame(time => {
//             resolve(time);
//         })
//     });
// }

// async function sleep(time: number) {
//     return new Promise(resolve => {
//         self.setTimeout(resolve, time);
//     });
// }

