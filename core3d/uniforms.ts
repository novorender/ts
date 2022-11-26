import type { WebGL2Renderer } from "webgl2";

const uniformTypes = {
    bool: { type: "i32", alignment: 1, components: 1, rows: 1 },
    int: { type: "i32", alignment: 1, components: 1, rows: 1 },
    uint: { type: "u32", alignment: 1, components: 1, rows: 1 },
    float: { type: "f32", alignment: 1, components: 1, rows: 1 },

    ivec2: { type: "i32", alignment: 2, components: 2, rows: 1 },
    uivec2: { type: "u32", alignment: 2, components: 2, rows: 1 },
    vec2: { type: "f32", alignment: 2, components: 2, rows: 1 },

    ivec3: { type: "i32", alignment: 4, components: 3, rows: 1 },
    uivec3: { type: "u32", alignment: 4, components: 3, rows: 1 },
    vec3: { type: "f32", alignment: 4, components: 3, rows: 1 },

    ivec4: { type: "i32", alignment: 4, components: 3, rows: 1 },
    uivec4: { type: "u32", alignment: 4, components: 3, rows: 1 },
    vec4: { type: "f32", alignment: 4, components: 4, rows: 1 },

    mat3: { type: "f32", alignment: 4, components: 3, rows: 3 },
    mat4: { type: "f32", alignment: 4, components: 4, rows: 4 },
} as const;

export type UniformTypes = keyof typeof uniformTypes;

class DirtyRange {
    constructor(public begin: number, public end: number) { }

    reset() {
        this.begin = Number.MAX_SAFE_INTEGER;
        this.end = 0;
    }

    get isEmpty() {
        return this.begin >= this.end;
    }

    expand(begin: number, end: number) {
        if (this.begin > begin) {
            this.begin = begin;
        }
        if (this.end < end) {
            this.end = end;
        }
    }
}

export interface UniformsProxy {
    readonly buffer: ArrayBuffer;
    readonly dirtyRange: DirtyRange;
    readonly uniforms: { [index: string]: boolean | number | ArrayLike<number> };
}

// apply std140 layout rules (https://registry.khronos.org/OpenGL/specs/gl/glspec45.core.pdf#page=159)
export function createUniformBufferProxy<T extends Record<string, UniformTypes>>(uniforms: T) {
    type Keys = Extract<keyof T, string>;
    const offsetsMap: Record<string, readonly number[]> = {};
    let offset = 0;
    for (const [key, value] of Object.entries(uniforms)) {
        const { alignment, components, rows } = uniformTypes[value];
        const padding = (alignment - 1) - ((offset + alignment - 1) % alignment);
        offset += padding;
        const offsets: number[] = [];
        for (let row = 0; row < rows; row++) {
            for (let component = 0; component < components; component++) {
                offsets.push(offset++);
            }
            // if (components == 3) {
            //     offset++; // pad to next vec4
            // }
            if (rows > 1) {
                offset = (offset + 3) & ~3; // align to the next vec4, regardless of component size
            }
        }
        offsetsMap[key] = offsets;
    }
    const byteSize = ((offset + 3) & ~3) * 4;

    const buffer = new ArrayBuffer(byteSize);
    const views = {
        i32: new Int32Array(buffer),
        u32: new Uint32Array(buffer),
        f32: new Float32Array(buffer),
    };
    const validators = {
        i32: (value: number) => {
            if (!Number.isInteger(value)) {
                throw new Error("Uniform value not an integer!");
            }
        },
        u32: (value: number) => {
            if (value < 0 || !Number.isInteger(value)) {
                throw new Error("Uniform value not an unsigned integer!");
            }
        },
        f32: (value: number) => { },
    };

    const dirtyRange = new DirtyRange(0, byteSize);

    const proxy = {
        buffer,
        dirtyRange,
        uniforms: {} as { [P in Keys]: T[P] extends "bool" ? boolean : T[P] extends "int" | "uint" | "float" ? number : ArrayLike<number> },
    } as const;

    for (const [key, value] of Object.entries(uniforms)) {
        const componentType = uniformTypes[value].type;
        const view = views[componentType];
        const validate = validators[componentType];
        const offsets = offsetsMap[key];
        const begin = offsets[0] * 4;
        const end = offsets[offsets.length - 1] * 4;
        const type = uniforms[key];
        const get =
            type == "bool" ? () => {
                return view[offsets[0]] != 0;
            } : type == "int" || type == "uint" || type == "float" ? () => {
                return view[offsets[0]] != 0;
            } : () => {
                return offsets.map(o => view[o]);
            };

        const set =
            type == "bool" ? (value: boolean) => {
                view[offsets[0]] = value ? 0 : -1;
                dirtyRange.expand(begin, end);
            } : type == "int" || type == "uint" || type == "float" ? (value: number) => {
                validate(value);
                view[offsets[0]] = value;
                dirtyRange.expand(begin, end);
            } : (values: ArrayLike<number>) => {
                console.assert(values.length == offsets.length);
                for (let i = 0; i < values.length; i++) {
                    validate(values[i]);
                    view[offsets[i]] = values[i];
                }
                dirtyRange.expand(begin, end);
            };

        Reflect.defineProperty(proxy.uniforms, key, {
            configurable: false,
            enumerable: true,
            get,
            set,
        });
    }

    return proxy;
}

export class UniformsHandler<T extends UniformsProxy> {
    buffer: WebGLBuffer | null = null;
    readonly values: T["uniforms"];

    constructor(readonly renderer: WebGL2Renderer, readonly proxy: T) {
        this.values = proxy.uniforms;
    }

    dispose() {
        const { renderer, buffer } = this;
        if (buffer)
            renderer.deleteBuffer(buffer);
        this.buffer = null;
    }

    update() {
        const { renderer, proxy } = this;
        if (!proxy.dirtyRange.isEmpty) {
            let { buffer } = this;
            if (!buffer) {
                this.buffer = buffer = renderer.createBuffer({ kind: "UNIFORM_BUFFER", srcData: proxy.buffer });
            }
            renderer.update({ kind: "UNIFORM_BUFFER", srcData: proxy.buffer, targetBuffer: buffer });
            proxy.dirtyRange.reset();
        }
    }
}



// const d = {
//     hasColor: "bool",
//     size: "int",
//     color: "vec4",
// } as const;

// const r = createUniformBufferProxy(d);
// r.uniforms.hasColor = true;
// r.uniforms.size = 4;
