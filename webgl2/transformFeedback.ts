export function glTransformFeedback(gl: WebGL2RenderingContext, params: TransformFeedbackParams) {
    const { kind, transformFeedback, outputBuffers, count, first } = params;
    const mode = gl[kind];
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, transformFeedback);
    for (let i = 0; i < outputBuffers.length; i++) {
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, outputBuffers[i]);
    }
    gl.beginTransformFeedback(mode);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.drawArrays(mode, first ?? 0, count);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.endTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    for (let i = 0; i < outputBuffers.length; i++) {
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, i, null);
    }
}

export type TransformFeedbackPrimitiveMode = "POINTS" | "LINES" | "TRIANGLES";

export interface TransformFeedbackParams {
    readonly kind: TransformFeedbackPrimitiveMode;
    readonly count: number;
    readonly first?: number; // default: 0
    readonly transformFeedback: WebGLTransformFeedback
    readonly outputBuffers: readonly WebGLBuffer[];
}
