export type U8 = Uint8Array;
export type U16 = Uint16Array;
export type U32 = Uint32Array;
export type I8 = Int8Array;
export type I16 = Int16Array;
export type I32 = Int32Array;
export type F16 = Uint16Array;
export type F32 = Float32Array;
export type F64 = Float64Array;

export type EnumArray<T> = { readonly [index: number]: T; };

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;
export type Float16Array = Uint16Array;
export const Float16Array = Uint16Array;

export class BufferReader {
    pos = 0;
    private readonly _u8;
    private readonly _u16;
    private readonly _u32;
    private readonly _i8;
    private readonly _i16;
    private readonly _i32;
    private readonly _f16;
    private readonly _f32;
    private readonly _f64;

    constructor(readonly buffer: ArrayBuffer) {
        this._u8 = new Uint8Array(buffer, 0, Math.floor(buffer.byteLength / Uint8Array.BYTES_PER_ELEMENT));
        this._u16 = new Uint16Array(buffer, 0, Math.floor(buffer.byteLength / Uint16Array.BYTES_PER_ELEMENT));
        this._u32 = new Uint32Array(buffer, 0, Math.floor(buffer.byteLength / Uint32Array.BYTES_PER_ELEMENT));
        this._i8 = new Int8Array(buffer, 0, Math.floor(buffer.byteLength / Int8Array.BYTES_PER_ELEMENT));
        this._i16 = new Int16Array(buffer, 0, Math.floor(buffer.byteLength / Int16Array.BYTES_PER_ELEMENT));
        this._i32 = new Int32Array(buffer, 0, Math.floor(buffer.byteLength / Int32Array.BYTES_PER_ELEMENT));
        this._f16 = new Uint16Array(buffer, 0, Math.floor(buffer.byteLength / Uint16Array.BYTES_PER_ELEMENT));
        this._f32 = new Float32Array(buffer, 0, Math.floor(buffer.byteLength / Float32Array.BYTES_PER_ELEMENT));
        this._f64 = new Float64Array(buffer, 0, Math.floor(buffer.byteLength / Float64Array.BYTES_PER_ELEMENT));
    }

    private read<T extends TypedArray>(ar: T, size: number): T {
        if (size == 0)
            return ar.subarray(0, 0) as T;
        const align = ar.BYTES_PER_ELEMENT;
        var padding = (align - 1) - ((this.pos + align - 1) % align);
        console.assert(padding >= 0 && padding < align);
        const begin = (this.pos + padding) / align;
        const end = begin + size;
        this.pos = end * ar.BYTES_PER_ELEMENT;
        return ar.subarray(begin, end) as T;
    }

    get eof() {
        return this.pos == this.buffer.byteLength;
    }

    u8(size: number) {
        return this.read(this._u8, size);
    }

    u16(size: number) {
        return this.read(this._u16, size);
    }

    u32(size: number) {
        return this.read(this._u32, size);
    }

    i8(size: number) {
        return this.read(this._i8, size);
    }

    i16(size: number) {
        return this.read(this._i16, size);
    }

    i32(size: number) {
        return this.read(this._i32, size);
    }

    f16(size: number) {
        return this.read(this._f16, size);
    }

    f32(size: number) {
        return this.read(this._f32, size);
    }

    f64(size: number) {
        return this.read(this._f64, size);
    }
}
