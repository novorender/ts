export function glDelete(gl: WebGL2RenderingContext, params: DeleteParams) {
    if (params === null)
        return;
    const isGLResource = params.constructor.name.startsWith("WebGL");
    const resources: WebGLResource[] = Array.isArray(params) ? params : isGLResource ? [params] : Object.values(params);

    for (const resource of resources) {
        if (resource === null) // ignore nulls
            continue;
        if (resource instanceof WebGLBuffer) {
            gl.deleteBuffer(resource);
        } else if (resource instanceof WebGLFramebuffer) {
            gl.deleteFramebuffer(resource);
        } else if (resource instanceof WebGLProgram) {
            gl.deleteProgram(resource);
        } else if (resource instanceof WebGLQuery) {
            gl.deleteQuery(resource);
        } else if (resource instanceof WebGLRenderbuffer) {
            gl.deleteRenderbuffer(resource);
        } else if (resource instanceof WebGLSampler) {
            gl.deleteSampler(resource);
        } else if (resource instanceof WebGLShader) {
            gl.deleteShader(resource);
        } else if (resource instanceof WebGLSync) {
            gl.deleteSync(resource);
        } else if (resource instanceof WebGLTransformFeedback) {
            gl.deleteTransformFeedback(resource);
        } else if (resource instanceof WebGLTexture) {
            gl.deleteTexture(resource);
        } else if (resource instanceof WebGLVertexArrayObject) {
            gl.deleteVertexArray(resource);
        } else {
            throw new Error(`Unknown WebGL resource: ${resource}!`);
        }
    }
}

export type WebGLResource = WebGLBuffer | WebGLFramebuffer | WebGLProgram | WebGLQuery | WebGLRenderbuffer | WebGLSampler | WebGLShader | WebGLSync | WebGLTransformFeedback | WebGLTexture | WebGLTransformFeedback | WebGLVertexArrayObject;
export type DeleteParams = WebGLResource | readonly WebGLResource[] | WebGLResourceContainer | null;
export type WebGLResourceContainer = { readonly [key: string]: WebGLResource | null };
