export function glBuffer(gl: WebGL2RenderingContext, params: BufferParams): WebGLBuffer {
    const target = gl[params.kind];
    const usage = gl[params.usage ?? "STATIC_DRAW"];
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(target, buffer);
    if ("size" in params) {
        gl.bufferData(target, params.size, usage);
    } else {
        gl.bufferData(target, params.srcData, usage);
    }
    gl.bindBuffer(target, null);
    return buffer;
}

export function glUpdateBuffer(gl: WebGL2RenderingContext, params: UpdateParams) {
    const target = gl[params.kind];
    const srcOffset = params.srcOffset ?? 0;
    const targetOffset = params.targetOffset ?? 0;
    const src = params.srcData;
    const srcData = ArrayBuffer.isView(src) ? src : new Uint8Array(src);
    gl.bindBuffer(target, params.targetBuffer);
    gl.bufferSubData(target, targetOffset, srcData, srcOffset, params.size);
    gl.bindBuffer(target, null);
}

export type BufferParams = BufferParamsSize | BufferParamsData;

export type BufferTargetString = "ARRAY_BUFFER" | "ELEMENT_ARRAY_BUFFER" | "COPY_READ_BUFFER" | "COPY_WRITE_BUFFER" | "TRANSFORM_FEEDBACK_BUFFER" | "UNIFORM_BUFFER" | "PIXEL_PACK_BUFFER" | "PIXEL_UNPACK_BUFFER";
export type BufferUsageString = "STATIC_DRAW" | "DYNAMIC_DRAW" | "STREAM_DRAW" | "STATIC_READ" | "DYNAMIC_READ" | "STREAM_READ" | "STATIC_COPY" | "DYNAMIC_COPY" | "STREAM_COPY";

export interface BufferParamsSize {
    readonly kind: BufferTargetString;
    readonly size: GLsizeiptr;
    readonly usage?: BufferUsageString; // default: "STATIC_DRAW"
}

export interface BufferParamsData {
    readonly kind: BufferTargetString;
    readonly srcData: BufferSource;
    readonly usage?: BufferUsageString; // default: "STATIC_DRAW"
}

export interface UpdateParams {
    readonly kind: BufferTargetString;
    readonly srcData: BufferSource;
    readonly targetBuffer: WebGLBuffer;
    readonly srcOffset?: number; // default: 0
    readonly targetOffset?: number; // default: 0
    readonly size?: number; // default: 0, which will copy entire srcData
}
