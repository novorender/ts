import type { ComponentType, ShaderAttributeType } from "webgl2";

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;
type TypedArrayCtor = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor | Int8ArrayConstructor | Int16ArrayConstructor | Int32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor;


/** @internal */
// this interface reflects the vertex attributes declared in vertex shader, in order

type Dictionary<T> = { [key: string]: T };
export const enum VertexAttributesEnum { position, normal, material, objectId, texCoord0, color0, projectedPos, pointFactors0, pointFactors1, highlight };
export type VertexAttribNames = keyof typeof VertexAttributesEnum;
export type VertexAttributes<T = VertexAttributeData> = { readonly [P in VertexAttribNames]: T | null };

/** @internal */
export interface VertexAttributeData {
    readonly kind: ShaderAttributeType;
    readonly componentType: ComponentType;
    readonly buffer: number; // index into buffer array
    readonly componentCount: 1 | 2 | 3 | 4;
    readonly normalized: boolean;
    readonly byteStride: number;
    readonly byteOffset: number;
};

/** @internal */
// partial vertex attribute with reference to binary file source array(s)
export interface VertexAttributeSource {
    readonly kind: ShaderAttributeType;
    readonly componentType: ComponentType;
    readonly componentViewType: TypedArrayCtor;
    components: readonly TypedArray[]; // component input scalar array(s) (from binary file), or empty array(s) if value is to be filled
    readonly normalized: boolean;
    readonly buffer: number; // index into buffer array
    readonly componentCount: 1 | 2 | 3 | 4;
}


/** @internal */
// partial vertex attribute with reference to binary file source array(s)
export interface VertexAttributeSourceLayout extends VertexAttributeSource {
    readonly byteOffset: number;
    readonly byteStride: number;
}

function getComponentType(type: TypedArrayCtor, float16: boolean) {
    if (float16) {
        console.assert(type == Uint16Array);
        return "HALF_FLOAT";
    }
    switch (type) {
        case Uint8Array:
            return "UNSIGNED_BYTE";
        case Uint16Array:
            return "UNSIGNED_SHORT";
        case Uint32Array:
            return "UNSIGNED_INT";
        case Int8Array:
            return "BYTE";
        case Int16Array:
            return "SHORT";
        case Int32Array:
            return "INT";
        case Float32Array:
            return "FLOAT";
    }
    throw new Error(`Missing component type, ${type}`);
}

export function vertexAttributeFloat<T extends TypedArray>(components: readonly T[], buffer: number, float16: boolean = false): VertexAttributeSource {
    const n = components.length as 1 | 2 | 3 | 4;
    console.assert(n > 0 || n <= 4);
    const prototype = Object.getPrototypeOf(components[0]).constructor as TypedArrayCtor;
    const normalized = prototype.name.startsWith("Float") || float16 ? false : true
    return {
        kind: n == 1 ? "FLOAT" : `FLOAT_VEC${n}`,
        componentViewType: prototype,
        componentType: getComponentType(prototype, float16),
        components: components,
        normalized,
        buffer,
        componentCount: n
    };
}

export function vertexAttributeInt<T extends Int8Array | Int16Array | Int32Array>(components: readonly T[], buffer: number): VertexAttributeSource {
    const n = components.length as 1 | 2 | 3 | 4;
    console.assert(n > 0 || n <= 4);
    return {
        kind: n == 1 ? "INT" : `INT_VEC${n}`,
        componentViewType: Object.getPrototypeOf(components[0]).constructor as TypedArrayCtor,
        componentType: components[0] instanceof Int8Array ? "BYTE" : components[0] instanceof Int16Array ? "SHORT" : "INT",
        components: components,
        normalized: false,
        buffer,
        componentCount: n
    };
}

export function vertexAttributeUint<T extends Uint8Array | Uint16Array | Uint32Array>(components: readonly T[], buffer: number): VertexAttributeSource {
    const n = components.length as 1 | 2 | 3 | 4;
    console.assert(n > 0 || n <= 4);
    return {
        kind: n == 1 ? "UNSIGNED_INT" : `UNSIGNED_INT_VEC${n}`,
        componentViewType: Object.getPrototypeOf(components[0]).constructor as TypedArrayCtor,
        componentType: components[0] instanceof Uint8Array ? "UNSIGNED_BYTE" : components[0] instanceof Uint16Array ? "UNSIGNED_SHORT" : "UNSIGNED_INT",
        components: components,
        normalized: false,
        buffer,
        componentCount: n
    };
}

function alignOffset(offset: number, alignment: number): number {
    const padding = alignment - 1 - (offset + alignment - 1) % alignment;
    return offset + padding; // pad offset to be memory aligned.
}

export function layoutAttributes(sourceAttributes: VertexAttributes<VertexAttributeSource>): {
    readonly attributes: VertexAttributes<VertexAttributeSourceLayout>,
    readonly byteStrides: number[]
} {
    const filterAttribs = Object.entries(sourceAttributes).filter(([name, attrib]) => attrib) as [string, VertexAttributeSource][];
    const attribs = filterAttribs.map(([name, attrib]) => {
        const componentByteSize = attrib!.components[0].BYTES_PER_ELEMENT;
        return { name, componentByteSize, ...attrib, byteOffset: 0, byteStride: 0 };
    })

    // compute attribute byte offsets, per buffer
    const numBuffers = attribs.map(a => a.buffer).reduce((a, b) => Math.max(a, b)) + 1;
    const byteOffsets = new Array<number>(numBuffers);
    const maxByteSizes = new Array<number>(numBuffers);
    {
        // sort attributes by component byte size in descending order for a potentially more compact/optimal layout
        const sortedAttribs = attribs.toSorted((a, b) => (b.componentByteSize - a.componentByteSize));
        for (const attrib of sortedAttribs) {
            const { componentByteSize, buffer, componentCount } = attrib;
            const byteOffset = alignOffset(byteOffsets[buffer] ?? 0, componentByteSize);
            byteOffsets[buffer] = byteOffset + componentByteSize * componentCount;
            attrib.byteOffset = byteOffset;
            maxByteSizes[buffer] = Math.max(maxByteSizes[buffer] ?? 0, componentByteSize);
        }
        console.assert(maxByteSizes.every(s => s)); // assert that there are no gaps in buffer indices
    }

    // compute byte strides
    const byteStrides = new Array<number>(numBuffers);
    for (let i = 0; i < numBuffers; i++) {
        byteStrides[i] = alignOffset(byteOffsets[i], maxByteSizes[i]); // ensure stride is a multiple of the largest component byte size for each buffer
    }
    for (const attrib of attribs) {
        const { buffer } = attrib;
        attrib.byteStride = byteStrides[buffer];
    }

    // generate output attributes
    const attributes: Dictionary<VertexAttributeSourceLayout | null> = {};
    for (const attrib of attribs) {
        const { name, ...rest } = attrib;
        attributes[name] = rest;
    }
    for (const name in sourceAttributes) {
        if (sourceAttributes[name as keyof typeof sourceAttributes] == null) {
            attributes[name] = null;
        }
    }
    return { attributes: attributes as VertexAttributes<VertexAttributeSourceLayout>, byteStrides } as const;
}

export function initVertexBufferRange(buffers: ArrayBuffer[], beginVertex: number, endVertex: number, dstOffset: number, fillValues: Readonly<Dictionary<number>>, attributes: VertexAttributes<VertexAttributeSourceLayout>) {
    // const buffers = byteStrides.map(bs => new ArrayBuffer(bs * numVertices));
    const numVertices = endVertex - beginVertex;
    for (const key in attributes) {
        const value = attributes[key as keyof typeof attributes];
        if (value) {
            const { buffer, componentViewType, components, byteOffset, byteStride } = value;
            const dst = new componentViewType(buffers[buffer], dstOffset * byteStride, numVertices * byteStride / componentViewType.BYTES_PER_ELEMENT);
            for (let i = 0; i < components.length; i++) {
                const offs = byteOffset + i * componentViewType.BYTES_PER_ELEMENT;
                if (components[0].length == 0) {
                    //const src = Reflect.get(fillValues, key) as number;
                    const src = fillValues[key];
                    if (src != undefined) {
                        fillToInterleavedArray(dst, src, offs, byteStride, beginVertex, endVertex);
                    }
                } else {
                    const src = components[i];
                    copyToInterleavedArray(dst, src, offs, byteStride, beginVertex, endVertex);
                }
            }
        }

    }
}

export function vertexAttributeData(attribs: VertexAttributes<VertexAttributeSourceLayout>): VertexAttributes {
    const entries = Object.entries(attribs).map(([key, value]) => {
        if (value == null) {
            return [key, null];
        }
        const { components, componentViewType, ...rest } = value as VertexAttributeSourceLayout;
        return [key, rest as VertexAttributeData];
    });
    return Object.fromEntries(entries) as VertexAttributes;
}

// Candidates for wasm implementation?
function copyToInterleavedArray<T extends TypedArray>(dst: T, src: T, byteOffset: number, byteStride: number, begin: number, end: number) {
    const offset = byteOffset / dst.BYTES_PER_ELEMENT;
    const stride = byteStride / dst.BYTES_PER_ELEMENT;
    console.assert(Math.round(offset) == offset);
    console.assert(Math.round(stride) == stride);
    let j = offset;
    for (let i = begin; i < end; i++) {
        dst[j] = src[i];
        j += stride;
    }
}

function fillToInterleavedArray<T extends TypedArray>(dst: T, src: number, byteOffset: number, byteStride: number, begin: number, end: number) {
    const offset = byteOffset / dst.BYTES_PER_ELEMENT;
    const stride = byteStride / dst.BYTES_PER_ELEMENT;
    console.assert(Math.round(offset) == offset);
    console.assert(Math.round(stride) == stride);
    let j = offset;
    for (let i = begin; i < end; i++) {
        dst[j] = src;
        j += stride;
    }
}
