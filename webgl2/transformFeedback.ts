export function glTransformFeedback(gl: WebGL2RenderingContext, tf: WebGLTransformFeedback, params: TransformFeedbackParams) {
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    let idx = 0;
    for (const buffer of params.outputBuffers) {
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, idx++, buffer);
    }
    gl.beginTransformFeedback(gl[params.primitiveMode]);
}

export type TransformFeedbackPrimitiveMode = "POINTS" | "LINES" | "TRIANGLES";

export interface TransformFeedbackParams {
    readonly primitiveMode: TransformFeedbackPrimitiveMode;
    readonly outputBuffers: readonly WebGLBuffer[];
}
