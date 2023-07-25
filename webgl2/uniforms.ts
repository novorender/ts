import { glCreateBuffer } from "./buffer";
import { GL } from "./constants";

export function glGetUniformsInfo(gl: WebGL2RenderingContext, program: WebGLProgram) {
    const numUniforms = gl.getProgramParameter(program, GL.ACTIVE_UNIFORMS);
    const uniformData: any[] = [];
    const uniformIndices: number[] = [];

    for (let i = 0; i < numUniforms; ++i) {
        uniformIndices.push(i);
        uniformData.push({});
        const uniformInfo = gl.getActiveUniform(program, i)!;
        uniformData[i].name = uniformInfo.name;
    }

    function getInfo(pname: number, key: string) {
        gl.getActiveUniforms(program, uniformIndices, pname).forEach(function (value: string, idx: number) {
            uniformData[idx][key] = value;
        });
    }
    getInfo(GL.UNIFORM_TYPE, "type");
    getInfo(GL.UNIFORM_SIZE, "size");
    getInfo(GL.UNIFORM_BLOCK_INDEX, "blockIndex");
    getInfo(GL.UNIFORM_OFFSET, "offset");
    return uniformData as readonly UniformInfo[];
}

export type UniformType =
    GL.FLOAT | GL.FLOAT_VEC2 | GL.FLOAT_VEC3 | GL.FLOAT_VEC4 |
    GL.INT | GL.INT_VEC2 | GL.INT_VEC3 | GL.INT_VEC4 |
    GL.UNSIGNED_INT | GL.UNSIGNED_INT_VEC2 | GL.UNSIGNED_INT_VEC3 | GL.UNSIGNED_INT_VEC4 |
    GL.BOOL | GL.BOOL_VEC2 | GL.BOOL_VEC3 | GL.BOOL_VEC4 |
    GL.FLOAT_MAT2 | GL.FLOAT_MAT3 | GL.FLOAT_MAT4 |
    GL.FLOAT_MAT2x3 | GL.FLOAT_MAT2x4 | GL.FLOAT_MAT3x2 | GL.FLOAT_MAT3x4 | GL.FLOAT_MAT4x2 | GL.FLOAT_MAT4x3 |
    GL.SAMPLER_2D | GL.SAMPLER_2D_ARRAY | GL.SAMPLER_2D_ARRAY_SHADOW | GL.SAMPLER_2D_ARRAY_SHADOW | GL.SAMPLER_3D | GL.SAMPLER_CUBE | GL.SAMPLER_CUBE_SHADOW;

export interface UniformInfo {
    readonly name: string;
    readonly type: UniformType;
    readonly size: number; // num elements
    readonly blockIndex: number; // -1 if not in block
    readonly offset: number; // -1 if not in block
}

export function glUniformLocations<const T extends readonly string[]>(gl: WebGL2RenderingContext, program: WebGLProgram, names: T, prefix?: string) {
    const locations: any = {};
    for (const name of names) {
        locations[name] = gl.getUniformLocation(program, `${prefix ?? ""}${name}`);
    }
    return locations as Record<T[number], WebGLUniformLocation | null>;
}

// apply std140 layout rules (https://registry.khronos.org/OpenGL/specs/gl/glspec45.core.pdf#page=159)
export function glUBOProxy<const T extends Record<string, UniformTypes>>(values: T) {
    type Keys = Extract<keyof T, string>;
    const offsetsMap: Record<string, readonly number[]> = {};
    let offset = 0;
    for (const [key, value] of Object.entries(values)) {
        const { alignment, components, rows } = uniformTypes[value];
        const padding = (alignment - 1) - ((offset + alignment - 1) % alignment);
        offset += padding;
        const offsets: number[] = [];
        for (let row = 0; row < rows; row++) {
            for (let component = 0; component < components; component++) {
                offsets.push(offset++);
            }
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

    const dirtyRange = new DirtyRange(byteSize);

    const proxy = {
        buffer,
        dirtyRange,
        values: {} as { [P in Keys]: T[P] extends "bool" ? boolean : T[P] extends "int" | "uint" | "float" ? number : ArrayLike<number> },
    } as const;

    for (const [key, value] of Object.entries(values)) {
        const componentType = uniformTypes[value].type;
        const view = views[componentType];
        const validate = validators[componentType];
        const offsets = offsetsMap[key];
        const begin = offsets[0] * 4;
        const end = offsets[offsets.length - 1] * 4 + 4;
        const type = values[key];
        const get =
            type == "bool" ? () => {
                return view[offsets[0]] != 0;
            } : type == "int" || type == "uint" || type == "float" ? () => {
                return view[offsets[0]];
            } : () => {
                return offsets.map(o => view[o]);
            };

        const set =
            type == "bool" ? (value: boolean) => {
                view[offsets[0]] = value ? 1 : 0;
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

        Reflect.defineProperty(proxy.values, key, {
            configurable: false,
            enumerable: true,
            get,
            set,
        });
    }

    return proxy;
}

class DirtyRange {
    begin: number;
    end: number;

    constructor(readonly size: number) {
        this.begin = 0;
        this.end = size;
    }

    get isEmpty() {
        return this.begin >= this.end;
    }

    clear() {
        this.begin = this.size;
        this.end = 0;
    }

    reset() {
        this.begin = 0;
        this.end = this.size;
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
    readonly values: { [index: string]: boolean | number | ArrayLike<number> };
}

const uniformTypes = {
    bool: { type: "i32", alignment: 1, components: 1, rows: 1 },
    int: { type: "i32", alignment: 1, components: 1, rows: 1 },
    uint: { type: "u32", alignment: 1, components: 1, rows: 1 },
    float: { type: "f32", alignment: 1, components: 1, rows: 1 },

    ivec2: { type: "i32", alignment: 2, components: 2, rows: 1 },
    uvec2: { type: "u32", alignment: 2, components: 2, rows: 1 },
    vec2: { type: "f32", alignment: 2, components: 2, rows: 1 },

    ivec3: { type: "i32", alignment: 4, components: 3, rows: 1 },
    uvec3: { type: "u32", alignment: 4, components: 3, rows: 1 },
    vec3: { type: "f32", alignment: 4, components: 3, rows: 1 },

    ivec4: { type: "i32", alignment: 4, components: 3, rows: 1 },
    uvec4: { type: "u32", alignment: 4, components: 3, rows: 1 },
    vec4: { type: "f32", alignment: 4, components: 4, rows: 1 },

    mat3: { type: "f32", alignment: 4, components: 3, rows: 3 },
    mat4: { type: "f32", alignment: 4, components: 4, rows: 4 },
} as const;

export type UniformTypes = keyof typeof uniformTypes;
