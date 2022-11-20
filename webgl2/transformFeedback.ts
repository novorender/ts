import type { TransformFeedbackParams, TransformFeedbackTestParams } from "./types";
import type { RendererContext } from ".";

export function createTransformFeedback(gl: WebGL2RenderingContext) {
    const tf = gl.createTransformFeedback()!;
    if (!tf)
        throw new Error("Could not create transform feedback!");
    return tf;
}

export function beginTransformFeedback(context: RendererContext, tf: WebGLTransformFeedback, params: TransformFeedbackParams) {
    const { gl } = context;
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    let idx = 0;
    for (const buffer of params.outputBuffers) {
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, idx++, buffer);
    }
    gl.beginTransformFeedback(gl[params.primitiveMode]);
}

export function endTransformFeedback(context: RendererContext, params?: TransformFeedbackTestParams) {
    const { gl } = context;
    gl.endTransformFeedback();
    if (params) {
        gl.flush();
        const data = params.expectedResult;
        const expected = new Int32Array(ArrayBuffer.isView(data) ? data.buffer : data);
        const feedback = new Int32Array(expected.length);
        gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, feedback);
        for (let i = 0; i < feedback.length; i++) {
            console.assert(feedback[i] == expected[i]);
        }
    }
    // const maxBuffers = context.limits.MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS;
    // for (let i = 0; i < maxBuffers; i++) {
    //     gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, null);
    // }
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
}