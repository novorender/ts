export function glCopy(gl: WebGL2RenderingContext, params: CopyParams) {
    const readOffset = params.readOffset ?? 0;
    const writeOffset = params.writeOffset ?? 0;
    gl.bindBuffer(gl.COPY_READ_BUFFER, params.readBuffer);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, params.writeBuffer);
    gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, readOffset, writeOffset, params.size);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
}

export interface CopyParams {
    readonly readBuffer: WebGLBuffer;
    readonly writeBuffer: WebGLBuffer;
    readonly readOffset?: number; // default: 0
    readonly writeOffset?: number; // default: 0
    readonly size: number;
}
