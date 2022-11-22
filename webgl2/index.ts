import type { BlitParams, BufferParams, ClearParams, CopyParams, DrawParams, FrameBufferParams, ProgramParams, ReadPixelsParams, RenderBufferParams, SamplerParams, StateParams, TextureParams, VertexArrayParams, Pixels, InvalidateFrameBufferParams, UpdateParams, TransformFeedbackParams, TransformFeedbackTestParams } from "./types";
import { createContext, RendererContext } from "./context.js";
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
import { setState } from "./state.js";
import { readPixelsAsync } from "./read.js";
import { beginTransformFeedback, createTransformFeedback, endTransformFeedback } from "./transformFeedback.js";
export type { RendererContext };
export * from "./types";
export { resizeCanvasToDisplaySize } from "./util.js";

export function createWebGL2Renderer(canvas: HTMLCanvasElement, options?: WebGLContextAttributes): WebGL2Renderer {
    const gl = canvas.getContext("webgl2", options);
    if (!gl)
        throw new Error("Unable to create WebGL 2 context!");

    canvas.addEventListener("webglcontextlost", function (event) {
        // event.preventDefault();
        // TODO: Handle!
        console.error("WebGL Context lost");
    }, false);

    canvas.addEventListener(
        "webglcontextrestored", function (event) {
            // event.preventDefault();
            // TODO: Handle!
            console.info("WebGL Context restored");
        }, false);

    return new WebGL2Renderer(gl, canvas);
}

export class WebGL2Renderer {
    readonly #context; // we dont want anything GL specific to leak outside
    readonly #promises: PolledPromise[] = [];
    #timer: Timer | undefined;
    #animFrameHandle: number | undefined;
    #currentTransformFeedback: WebGLTransformFeedback | undefined;

    constructor(gl: WebGL2RenderingContext, readonly canvas: HTMLCanvasElement) {
        this.#context = createContext(gl);
    }

    dispose() {
        if (this.#animFrameHandle !== undefined) {
            cancelAnimationFrame(this.#animFrameHandle);
            this.#animFrameHandle = undefined;
        }
        this.state(this.#context.defaultState); // make sure resources are unbound before deleting them.
        for (const promise of this.#promises) {
            promise.dispose();
        }
    }

    get width() {
        return this.#context.gl.drawingBufferWidth;
    }

    get height() {
        return this.#context.gl.drawingBufferHeight;
    }

    pollPromises() {
        const promises = this.#promises;
        for (let i = 0; i < promises.length; i++) {
            const promise = promises[i];
            if (promise.poll()) {
                promises.splice(i--, 1);
            }
        }
        return promises.length > 0;
    }

    flush() {
        this.#context.gl.flush();
    }

    async nextFrame() {
        const promise = new Promise<number>(resolve => {
            this.#animFrameHandle = requestAnimationFrame(time => {
                this.#animFrameHandle = undefined;
                resolve(time);
            })
        });
        const time = await promise;
        this.pollPromises();
        return time;
    }

    measureBegin() {
        const timer = createTimer(this.#context.gl);
        this.#timer = timer;
        timer.begin();
    }

    measureEnd(): Promise<number> {
        const timer = this.#timer!;
        timer.end();
        this.#timer = undefined;
        this.#promises.push(timer);
        return timer.promise;
    }

    createProgram(params: ProgramParams): WebGLProgram {
        return createProgram(this.#context, params);
    }

    deleteProgram(program: WebGLProgram) {
        const { gl } = this.#context;
        gl.deleteProgram(program);
    }

    createBuffer(params: BufferParams) {
        return createBuffer(this.#context, params);
    }

    deleteBuffer(buffer: WebGLBuffer) {
        const { gl } = this.#context;
        gl.deleteBuffer(buffer);
    }

    createVertexArray(params: VertexArrayParams): WebGLVertexArrayObject {
        return createVertexArray(this.#context, params);
    }

    deleteVertexArray(vao: WebGLVertexArrayObject) {
        const { gl } = this.#context;
        gl.deleteVertexArray(vao);
    }

    createSampler(params: SamplerParams): WebGLSampler {
        return createSampler(this.#context, params);
    }

    deleteSampler(sampler: WebGLSampler) {
        const { gl } = this.#context;
        gl.deleteSampler(sampler);
    }

    createTexture(params: TextureParams): WebGLTexture {
        return createTexture(this.#context, params);
    }

    deleteTexture(texture: WebGLTexture) {
        const { gl } = this.#context;
        gl.deleteTexture(texture);
    }

    createRenderBuffer(params: RenderBufferParams): WebGLRenderbuffer {
        return createRenderBuffer(this.#context, params);
    }

    deleteRenderBuffer(rb: WebGLRenderbuffer) {
        const { gl, } = this.#context;
        gl.deleteRenderbuffer(rb);
    }

    createFrameBuffer(params: FrameBufferParams): WebGLFramebuffer {
        return createFrameBuffer(this.#context, params);
    }

    invalidateFrameBuffer(params: InvalidateFrameBufferParams) {
        invalidateFrameBuffer(this.#context, params);
    }

    deleteFrameBuffer(fb: WebGLFramebuffer) {
        const { gl } = this.#context;
        gl.deleteFramebuffer(fb);
    }

    createTransformFeedback(): WebGLTransformFeedback {
        const { gl } = this.#context;
        return createTransformFeedback(gl);
    }

    deleteTransformFeedback(tf: WebGLTransformFeedback): void {
        const { gl } = this.#context;
        gl.deleteTransformFeedback(tf);
    }


    beginTransformFeedback(tf: WebGLTransformFeedback, params: TransformFeedbackParams): void {
        this.#currentTransformFeedback = tf;
        beginTransformFeedback(this.#context, tf, params);
    }

    pauseTransformFeedback(tf: WebGLTransformFeedback): void {
        const { gl } = this.#context;
        console.assert(tf == this.#currentTransformFeedback);
        gl.pauseTransformFeedback();
    }

    resumeTransformFeedback(tf: WebGLTransformFeedback): void {
        const { gl } = this.#context;
        console.assert(tf == this.#currentTransformFeedback);
        gl.resumeTransformFeedback();
    }

    endTransformFeedback(tf: WebGLTransformFeedback, params?: TransformFeedbackTestParams): void {
        console.assert(tf == this.#currentTransformFeedback);
        this.#currentTransformFeedback = undefined;
        endTransformFeedback(this.#context, params);
    }

    state(params: StateParams | null) {
        setState(this.#context, params ?? this.#context.defaultState);
    }

    clear(params: ClearParams) {
        clear(this.#context, params);
    }

    blit(params: BlitParams) {
        blit(this.#context, params);
    }

    readPixels(params: ReadPixelsParams): Promise<Pixels> {
        const result = readPixelsAsync(this.#context, params);
        this.#promises.push(result);
        return result.promise;
    }

    copy(params: CopyParams) {
        copy(this.#context, params);
    }

    update(params: UpdateParams) {
        update(this.#context, params);
    }

    draw(params: DrawParams) {
        draw(this.#context, params);
    }

    checkStatus(message: string = "GL") {
        const { gl } = this.#context;
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

