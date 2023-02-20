export function glCopy(gl: WebGL2RenderingContext, params: CopyParams) {
    const readByteOffset = params.readByteOffset ?? 0;
    const writeByteOffset = params.writeByteOffset ?? 0;
    gl.bindBuffer(gl.COPY_READ_BUFFER, params.readBuffer);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, params.writeBuffer);
    gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, readByteOffset, writeByteOffset, params.byteSize);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
}

export interface CopyParams {
    readonly readBuffer: WebGLBuffer;
    readonly writeBuffer: WebGLBuffer;
    readonly readByteOffset?: number; // default: 0
    readonly writeByteOffset?: number; // default: 0
    readonly byteSize: number;
}
