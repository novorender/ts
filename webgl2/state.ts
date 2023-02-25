import { glExtensions } from "./extensions";
import { glLimits, type LimitsGL } from "./limits";

export function glState(gl: WebGL2RenderingContext, params: StateParams | null) {
    if (!params) {
        const limits = glLimits(gl);
        params = glDefaultState(limits);
    }

    const { blend, cull, depth, polygon, sample, scissor, stencil, frameBuffer, vertexArrayObject, drawBuffers, attributeDefaults, textures, uniforms, uniformBuffers } = params;

    function setFlag(cap: FilteredKeys<WebGL2RenderingContext, number>, value: boolean | undefined) {
        if (value !== undefined) {
            if (value) {
                gl.enable(gl[cap]);
            } else {
                gl.disable(gl[cap]);
            }
        }
    }

    function set<T>(setter: (this: WebGLRenderingContext, ...values: any) => void, values: T, defaultValues: any, ...keys: readonly (keyof T)[]) {
        if (keys.some(key => values![key] !== undefined)) {
            const args = keys.map(key => {
                const v = values![key] ?? defaultValues[key];
                return typeof v == "string" ? gl[v as keyof WebGL2RenderingContext] : v;
            });
            (<Function>setter).apply(gl, args);
        }
    }

    setFlag("DITHER", params.ditherEnable);
    setFlag("RASTERIZER_DISCARD", params.rasterizerDiscard);
    set((rgba: readonly [boolean, boolean, boolean, boolean]) => { gl.colorMask(...rgba); }, params, "colorMask");
    set(rect => gl.viewport(rect.x ?? 0, rect.y ?? 0, rect.width, rect.height), params, defaultConstants, "viewport");

    if (blend) {
        const defaultValues = defaultConstants.blend;
        const { drawBuffersIndexed } = glExtensions(gl);
        if (drawBuffersIndexed) {
            // only change settings for drawbuffer 0.
            if (blend.enable) {
                drawBuffersIndexed.enableiOES(gl.BLEND, 0);
            } else {
                drawBuffersIndexed.disableiOES(gl.BLEND, 0);
            }
            set((modeRGB, modeAlpha) => drawBuffersIndexed.blendEquationSeparateiOES(0, modeRGB, modeAlpha), blend, defaultValues, "equationRGB", "equationAlpha");
            set((srcRGB, dstRGB, srcAlpha, dstAlpha) => drawBuffersIndexed.blendFuncSeparateiOES(0, srcRGB, dstRGB, srcAlpha, dstAlpha), blend, defaultValues, "srcRGB", "dstRGB", "srcAlpha", "dstAlpha");
        } else {
            setFlag("BLEND", blend.enable);
            set(gl.blendEquationSeparate, blend, defaultValues, "equationRGB", "equationAlpha");
            set(gl.blendFuncSeparate, blend, defaultValues, "srcRGB", "dstRGB", "srcAlpha", "dstAlpha");
        }
        set((rgba: readonly [number, number, number, number]) => { gl.blendColor(...rgba); }, blend, defaultValues, "color");
    }

    if (cull) {
        const defaultValues = defaultConstants.cull;
        setFlag("CULL_FACE", cull.enable);
        set(gl.cullFace, cull, defaultValues, "mode");
        set(gl.frontFace, cull, defaultValues, "frontFace");
    }

    if (depth) {
        const defaultValues = defaultConstants.depth;
        setFlag("DEPTH_TEST", depth.test);
        set(gl.depthFunc, depth, defaultValues, "func");
        set(gl.depthMask, depth, defaultValues, "writeMask");
        set((range: readonly [number, number]) => gl.depthRange(...range), depth, defaultValues, "range");
    }

    if (polygon) {
        const defaultValues = defaultConstants.polygon;
        setFlag("POLYGON_OFFSET_FILL", polygon.offsetFill);
        set(gl.polygonOffset, polygon, defaultValues, "offsetFactor", "offsetUnits");
    }

    if (sample) {
        const defaultValues = defaultConstants.sample;
        setFlag("SAMPLE_ALPHA_TO_COVERAGE", sample.alphaToCoverage);
        setFlag("SAMPLE_COVERAGE", sample.coverage);
        set(gl.sampleCoverage, sample, defaultValues, "coverageValue", "coverageInvert");
    }

    if (scissor) {
        const defaultValues = defaultConstants.scissor;
        setFlag("SCISSOR_TEST", scissor.test);
        set(rect => gl.scissor(rect.x ?? 0, rect.y ?? 0, rect.width, rect.height), scissor, defaultValues, "box");
    }

    if (stencil) {
        const defaultValues = defaultConstants.stencil;
        setFlag("STENCIL_TEST", stencil.test);
        set((func, ref, mask) => gl.stencilFuncSeparate(gl.FRONT, func, ref, mask), stencil, defaultValues, "func", "ref", "valueMask");
        set((func, ref, mask) => gl.stencilFuncSeparate(gl.BACK, func, ref, mask), stencil, defaultValues, "backFunc", "backRef", "backValueMask");
    }

    if (vertexArrayObject !== undefined) {
        gl.bindVertexArray(vertexArrayObject);
    }

    if (frameBuffer !== undefined) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    }

    if (drawBuffers) {
        gl.drawBuffers(drawBuffers.map(b => gl[b!]));
    }

    const { program } = params;
    if (program !== undefined) {
        gl.useProgram(program);
    }

    if (attributeDefaults) {
        for (let i = 0; i < attributeDefaults.length; i++) {
            const defaults = attributeDefaults[i];
            if (defaults) {
                const { type, values } = defaults;
                gl[`vertexAttrib${type}v`](i, values);
            }
        }
    }

    if (textures) {
        const texture0 = gl.TEXTURE0;
        for (let i = 0; i < textures.length; i++) {
            const binding = textures[i];
            const texture = binding?.texture ?? null;
            gl.activeTexture(texture0 + i);
            gl.bindTexture(gl[binding?.kind ?? "TEXTURE_2D"], texture);
            const sampler = binding?.sampler ?? null;
            gl.bindSampler(i, sampler);
            gl.uniform1i(binding?.uniform ?? null, i);
        }
        gl.activeTexture(texture0);
    }

    if (uniforms) {
        function isMatrix(binding: UniformBinding): binding is UniformBindingMatrix {
            return binding.kind.startsWith("Matrix");
        }
        function isScalar(binding: UniformBinding): binding is UniformBindingScalar {
            return binding.kind.startsWith("1");
        }
        for (const binding of uniforms) {
            if (isMatrix(binding)) {
                const methodName = `uniform${binding.kind}v` as const;
                gl[methodName](binding.location, binding.transpose ?? false, binding.value);
            } else if (isScalar(binding)) {
                const methodName = `uniform${binding.kind}` as const;
                gl[methodName](binding.location, binding.value);
            } else {
                const methodName = `uniform${binding.kind}v` as const;
                gl[methodName](binding.location, binding.value);
            }
        }
    }

    if (uniformBuffers) {
        let idx = 0;
        for (const uniformBindingParams of uniformBuffers) {
            if (uniformBindingParams === undefined)
                continue;
            if (isUniformBufferBindingRange(uniformBindingParams)) {
                const { buffer, byteOffset, byteSize } = uniformBindingParams;
                gl.bindBufferRange(gl.UNIFORM_BUFFER, idx, buffer, byteOffset, byteSize);
            } else {
                gl.bindBufferBase(gl.UNIFORM_BUFFER, idx, uniformBindingParams);
            }
            idx++;
        }
    }
}

export function glDefaultState(limits: LimitsGL): State {
    return {
        ...defaultConstants,
        drawBuffers: ["BACK"] as ReadonlyArray<ColorAttachment | "BACK" | "NONE">,
        attributeDefaults: Array<AttributeDefault | null>(limits.MAX_VERTEX_ATTRIBS).fill({ type: "4f", values: [0, 0, 0, 1] }) as ReadonlyArray<AttributeDefault | null>,
        textures: Array<TextureBinding | null>(limits.MAX_COMBINED_TEXTURE_IMAGE_UNITS).fill(null) as ReadonlyArray<TextureBinding | null>,
    } as const;
}

type ScopedParamsKeys = "blend" | "cull" | "depth" | "polygon" | "sample" | "stencil" | "scissor";
export type StateParams = Partial<Omit<State, ScopedParamsKeys>> & { readonly [P in ScopedParamsKeys]?: Partial<State[P]> };

export interface State {
    // blend state (except constant color) only applies to COLOR_ATTACHMENT0 if OES_draw_buffers_indexed is supported.
    readonly blend: {
        readonly enable: boolean; // BLEND
        readonly color: RGBA; // BLEND_COLOR
        readonly dstAlpha: BlendFunction; // BLEND_DST_ALPHA
        readonly dstRGB: BlendFunction; // BLEND_DST_RGB
        readonly equationAlpha: BlendEquation; // BLEND_EQUATION_ALPHA
        readonly equationRGB: BlendEquation; // BLEND_EQUATION_RGB
        readonly srcAlpha: BlendFunction; // BLEND_EQUATION_ALPHA
        readonly srcRGB: BlendFunction; // BLEND_SRC_RGB
    };

    readonly cull: {
        readonly enable: boolean; // CULL_FACE
        readonly mode: CullMode; // CULL_FACE_MODE
        readonly frontFace: Winding; // FRONT_FACE
    };

    readonly depth: {
        readonly test: boolean; // DEPTH_TEST
        readonly func: DepthFunc; // DEPTH_FUNC
        readonly writeMask: boolean; // DEPTH_WRITEMASK
        readonly range: readonly [near: number, far: number]; // DEPTH_RANGE
    };

    readonly polygon: {
        readonly offsetFill: boolean; // POLYGON_OFFSET_FILL
        readonly offsetFactor: number; // POLYGON_OFFSET_FACTOR
        readonly offsetUnits: number; // POLYGON_OFFSET_UNITS
    };

    readonly sample: {
        readonly alphaToCoverage: boolean; // SAMPLE_ALPHA_TO_COVERAGE
        readonly coverage: boolean; // SAMPLE_COVERAGE
        readonly coverageValue: number; // SAMPLE_COVERAGE_VALUE
        readonly coverageInvert: boolean; // SAMPLE_COVERAGE_INVERT
    };

    readonly stencil: {
        readonly test: boolean; // STENCIL_TEST
        readonly func: DepthFunc; // STENCIL_FUNC
        readonly valueMask: number; // STENCIL_VALUE_MASK
        readonly ref: number; // STENCIL_REF
        readonly backFunc: DepthFunc; // STENCIL_BACK_FUNC
        readonly backValueMask: number; // STENCIL_BACK_VALUE_MASK
        readonly backRef: number; // STENCIL_BACK_REF
    };

    readonly scissor: {
        readonly test: boolean; // SCISSOR_TEST
        readonly box: Rect;
    }

    readonly ditherEnable: boolean; // DITHER
    readonly colorMask: readonly [red: boolean, green: boolean, blue: boolean, alpha: boolean];
    readonly viewport: Rect;
    readonly rasterizerDiscard: boolean; // RASTERIZER_DISCARD
    readonly frameBuffer: WebGLFramebuffer | null;
    readonly vertexArrayObject: WebGLVertexArrayObject | null;
    readonly program: WebGLProgram | null;
    readonly uniforms: readonly UniformBinding[];
    readonly uniformBuffers: readonly UniformBufferBinding[]; // max length: MAX_UNIFORM_BUFFER_BINDINGS
    readonly drawBuffers: readonly (ColorAttachment | "BACK" | "NONE")[];
    readonly attributeDefaults: readonly (AttributeDefault | null)[];
    readonly textures: readonly (TextureBinding | null)[];
}


export type BlendEquation = "FUNC_ADD" | "FUNC_SUBTRACT" | "FUNC_REVERSE_SUBTRACT" | "MIN" | "MAX";
export type BlendFunction = "ZERO" | "ONE" | "SRC_COLOR" | "ONE_MINUS_SRC_COLOR" | "DST_COLOR" | "ONE_MINUS_DST_COLOR" | "SRC_ALPHA" | "ONE_MINUS_SRC_ALPHA" | "DST_ALPHA" | "ONE_MINUS_DST_ALPHA" | "CONSTANT_COLOR" | "ONE_MINUS_CONSTANT_COLOR" | "CONSTANT_ALPHA" | "ONE_MINUS_CONSTANT_ALPHA" | "SRC_ALPHA_SATURATE";
export type CullMode = "FRONT" | "BACK" | "FRONT_AND_BACK";
export type DepthFunc = "NEVER" | "LESS" | "EQUAL" | "LEQUAL" | "GREATER" | "NOTEQUAL" | "GEQUAL" | "ALWAYS";
export type Winding = "CW" | "CCW";
export type ColorAttachment = `COLOR_ATTACHMENT${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15}`;
export type RGBA = readonly [r: number, g: number, b: number, a: number];
export type XYZW = readonly [x: number, y: number, z: number, w: number];

export interface Rect {
    readonly x?: number;
    readonly y?: number;
    readonly width: number;
    readonly height: number;
}

export interface AttributeDefault {
    readonly type: "4f" | "I4i" | "I4ui";
    readonly values: XYZW;
}

export interface AttributeBinding {
    readonly type: "4f" | "I4i" | "I4ui";
    readonly values: XYZW;
}

export type UniformTypeScalar = "1f" | "1i" | "1ui";

export type UniformTypeVector =
    "2f" | "3f" | "4f" |
    "2i" | "3i" | "4i" |
    "2ui" | "3ui" | "4ui";

export type UniformTypeMatrix =
    "Matrix2f" | "Matrix3f" | "Matrix4f" |
    "Matrix2x3f" | "Matrix2x4f" |
    "Matrix3x2f" | "Matrix3x4f" |
    "Matrix4x2f" | "Matrix4x3f";

export interface UniformBindingScalar {
    readonly kind: UniformTypeScalar;
    readonly location: WebGLUniformLocation | null;
    readonly value: number;
}

export interface UniformBindingVector {
    readonly kind: UniformTypeVector;
    readonly location: WebGLUniformLocation | null;
    readonly value: readonly number[];
}

export interface UniformBindingMatrix {
    readonly kind: UniformTypeMatrix;
    readonly location: WebGLUniformLocation | null;
    readonly value: readonly number[];
    readonly transpose?: boolean; // default: false
}

export type UniformBinding = UniformBindingScalar | UniformBindingVector | UniformBindingMatrix;


export interface UniformBufferBindingRange {
    readonly buffer: WebGLBuffer;
    readonly byteOffset: number;
    readonly byteSize: number;
}

export type UniformBufferBinding = UniformBufferBindingRange | WebGLBuffer | null | undefined; // if undefined, the buffer binding will not be changed

export interface TextureBinding {
    readonly kind: "TEXTURE_2D" | "TEXTURE_3D" | "TEXTURE_2D_ARRAY" | "TEXTURE_CUBE_MAP";
    readonly texture: WebGLTexture | null;
    readonly sampler: WebGLSampler | null;
    readonly uniform?: WebGLUniformLocation | null;
}

type FilteredKeys<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

function isUniformBufferBindingRange(params: UniformBufferBindingRange | WebGLBuffer | null): params is UniformBufferBindingRange {
    return params != null && "byteOffset" in params && "byteSize" in params;
}

const defaultConstants = {
    blend: {
        enable: false, // BLEND
        color: [0, 0, 0, 0], // BLEND_COLOR
        dstAlpha: "ZERO", // BLEND_DST_ALPHA
        dstRGB: "ZERO", // BLEND_DST_RGB
        equationAlpha: "FUNC_ADD", // BLEND_EQUATION_ALPHA
        equationRGB: "FUNC_ADD", // BLEND_EQUATION_RGB
        srcAlpha: "ONE", // BLEND_EQUATION_ALPHA
        srcRGB: "ONE", // BLEND_SRC_RGB
    },

    cull: {
        enable: false, // CULL_FACE
        mode: "BACK", // CULL_FACE_MODE
        frontFace: "CCW", // FRONT_FACE
    },

    depth: {
        test: false, // DEPTH_TEST
        func: "LESS", // DEPTH_FUNC
        writeMask: true, // DEPTH_WRITEMASK
        range: [0, 1], // DEPTH_RANGE
    },

    ditherEnable: true, // DITHER

    colorMask: [true, true, true, true],

    polygon: {
        offsetFill: false, // POLYGON_OFFSET_FILL
        offsetFactor: 0, // POLYGON_OFFSET_FACTOR
        offsetUnits: 0, // POLYGON_OFFSET_UNITS
    },

    sample: {
        alphaToCoverage: false, // SAMPLE_ALPHA_TO_COVERAGE
        coverage: false, // SAMPLE_COVERAGE
        coverageValue: 1, // SAMPLE_COVERAGE_VALUE
        coverageInvert: false, // SAMPLE_COVERAGE_INVERT
    },

    stencil: {
        test: false, // STENCIL_TEST
        func: "ALWAYS", // STENCIL_FUNC
        valueMask: 0x7FFFFFFF, // STENCIL_VALUE_MASK
        ref: 0, // STENCIL_REF
        backFunc: "ALWAYS", // STENCIL_BACK_FUNC
        backValueMask: 0x7FFFFFFF, // STENCIL_BACK_VALUE_MASK
        backRef: 0, // STENCIL_BACK_REF
    },

    viewport: { // VIEWPORT
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    } as Rect,

    scissor: {
        test: false, // SCISSOR_TEST
        box: { // SCISSOR_BOX
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        } as Rect,
    },

    rasterizerDiscard: false, // RASTERIZER_DISCARD

    frameBuffer: null,
    vertexArrayObject: null,

    program: null,
    uniforms: [],
    uniformBuffers: [], // max length: MAX_UNIFORM_BUFFER_BINDINGS
} as const;
