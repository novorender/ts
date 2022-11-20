import type { RendererContext, CopyParams } from ".";

export function copy(context: RendererContext, params: CopyParams) {
    const { gl } = context;
    const readOffset = params.readOffset ?? 0;
    const writeOffset = params.writeOffset ?? 0;
    gl.bindBuffer(gl.COPY_READ_BUFFER, params.readBuffer);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, params.writeBuffer);
    gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, readOffset, writeOffset, params.size);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
}
