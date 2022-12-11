import { glLimits, LimitsGL } from "./limits";

export function glState(gl: WebGL2RenderingContext, params: StateParams | null) {
    if (!params) {
        const limits = glLimits(gl);
        params = glDefaultState(limits);
    }

    function setFlag(cap: FilteredKeys<WebGL2RenderingContext, number>, key: keyof StateParams) {
        const value = params![key];
        if (value !== undefined) {
            if (value) {
                gl.enable(gl[cap]);
            } else {
                gl.disable(gl[cap]);
            }
        }
    }

    function set(setter: (this: WebGLRenderingContext, ...values: any) => void, ...keys: readonly (keyof typeof defaultConstants)[]) {
        if (keys.some(key => params![key] !== undefined)) {
            const values = keys.map(key => {
                const v = params![key] ?? defaultConstants[key];
                return typeof v == "string" ? gl[v as keyof WebGL2RenderingContext] : v;
            });
            (<Function>setter).apply(gl, values);
        }
    }

    setFlag("BLEND", "blendEnable");
    set((rgba: readonly [number, number, number, number]) => { gl.blendColor(...rgba); }, "blendColor");
    set(gl.blendEquationSeparate, "blendEquationRGB", "blendEquationAlpha");
    set(gl.blendFuncSeparate, "blendSrcRGB", "blendDstRGB", "blendSrcAlpha", "blendDstAlpha");

    setFlag("CULL_FACE", "cullEnable");
    set(gl.cullFace, "cullMode");
    set(gl.frontFace, "cullFrontFace");

    setFlag("DEPTH_TEST", "depthTest");
    set(gl.depthFunc, "depthFunc");
    set(gl.depthMask, "depthWriteMask");
    set((range: readonly [number, number]) => gl.depthRange(...range), "depthRange");

    setFlag("DITHER", "ditherEnable");

    set((rgba: readonly [boolean, boolean, boolean, boolean]) => { gl.colorMask(...rgba); }, "colorMask");

    setFlag("POLYGON_OFFSET_FILL", "polygonOffsetFill");
    set(gl.polygonOffset, "polygonOffsetFactor", "polygonOffsetUnits");

    setFlag("SAMPLE_ALPHA_TO_COVERAGE", "sampleAlphaToCoverage");
    setFlag("SAMPLE_COVERAGE", "sampleCoverage");
    set(gl.sampleCoverage, "sampleCoverageValue", "sampleCoverageInvert");

    setFlag("STENCIL_TEST", "stencilTest");
    set((func, ref, mask) => gl.stencilFuncSeparate(gl.FRONT, func, ref, mask), "stencilFunc", "stencilRef", "stencilValueMask");
    set((func, ref, mask) => gl.stencilFuncSeparate(gl.BACK, func, ref, mask), "stencilBackFunc", "stencilBackRef", "stencilBackValueMask");

    set(rect => gl.viewport(rect.x ?? 0, rect.y ?? 0, rect.width, rect.height), "viewport");

    setFlag("SCISSOR_TEST", "scissorTest");
    set(rect => gl.scissor(rect.x ?? 0, rect.y ?? 0, rect.width, rect.height), "scissorBox");

    setFlag("RASTERIZER_DISCARD", "rasterizerDiscard");

    const { frameBuffer, vertexArrayObject, drawBuffers, attributeDefaults, textures, uniformBuffers } = params;

    if (vertexArrayObject !== undefined) {
        gl.bindVertexArray(vertexArrayObject);
    }

    if (frameBuffer !== undefined) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    }

    if (drawBuffers) {
        gl.drawBuffers(drawBuffers.map(b => gl[b]));
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

    if (uniformBuffers) {
        let idx = 0;
        for (const uniformBindingParams of uniformBuffers) {
            if (uniformBindingParams === undefined)
                continue;
            if (isUniformBufferBindingRange(uniformBindingParams)) {
                const { buffer, offset, size } = uniformBindingParams;
                gl.bindBufferRange(gl.UNIFORM_BUFFER, idx, buffer, offset, size);
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

export type StateParams = Partial<State>;

export interface State {
    readonly blendEnable: boolean; // BLEND
    readonly blendColor: RGBA; // BLEND_COLOR
    readonly blendDstAlpha: BlendFunction; // BLEND_DST_ALPHA
    readonly blendDstRGB: BlendFunction; // BLEND_DST_RGB
    readonly blendEquationAlpha: BlendEquation; // BLEND_EQUATION_ALPHA
    readonly blendEquationRGB: BlendEquation; // BLEND_EQUATION_RGB
    readonly blendSrcAlpha: BlendFunction; // BLEND_EQUATION_ALPHA
    readonly blendSrcRGB: BlendFunction; // BLEND_SRC_RGB

    readonly cullEnable: boolean; // CULL_FACE
    readonly cullMode: CullMode; // CULL_FACE_MODE
    readonly cullFrontFace: Winding; // FRONT_FACE

    readonly depthTest: boolean; // DEPTH_TEST
    readonly depthFunc: DepthFunc; // DEPTH_FUNC
    readonly depthWriteMask: boolean; // DEPTH_WRITEMASK
    readonly depthRange: readonly [near: number, far: number]; // DEPTH_RANGE

    readonly ditherEnable: boolean; // DITHER

    readonly colorMask: readonly [red: boolean, green: boolean, blue: boolean, alpha: boolean];

    readonly polygonOffsetFill: boolean; // POLYGON_OFFSET_FILL
    readonly polygonOffsetFactor: number; // POLYGON_OFFSET_FACTOR
    readonly polygonOffsetUnits: number; // POLYGON_OFFSET_UNITS

    readonly sampleAlphaToCoverage: boolean; // SAMPLE_ALPHA_TO_COVERAGE
    readonly sampleCoverage: boolean; // SAMPLE_COVERAGE
    readonly sampleCoverageValue: number; // SAMPLE_COVERAGE_VALUE
    readonly sampleCoverageInvert: boolean; // SAMPLE_COVERAGE_INVERT

    readonly stencilTest: boolean; // STENCIL_TEST
    readonly stencilFunc: DepthFunc; // STENCIL_FUNC
    readonly stencilValueMask: number; // STENCIL_VALUE_MASK
    readonly stencilRef: number; // STENCIL_REF
    readonly stencilBackFunc: DepthFunc; // STENCIL_BACK_FUNC
    readonly stencilBackValueMask: number; // STENCIL_BACK_VALUE_MASK
    readonly stencilBackRef: number; // STENCIL_BACK_REF
    readonly viewport: Rect;

    readonly scissorTest: boolean; // SCISSOR_TEST
    readonly scissorBox: Rect;

    readonly rasterizerDiscard: boolean; // RASTERIZER_DISCARD

    readonly frameBuffer: WebGLFramebuffer | null;
    readonly vertexArrayObject: WebGLVertexArrayObject | null;

    readonly program: WebGLProgram | null;
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
    readonly offset: number;
    readonly size: number;
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
    return params != null && "offset" in params && "size" in params;
}

const defaultConstants = {
    blendEnable: false, // BLEND
    blendColor: [0, 0, 0, 0], // BLEND_COLOR
    blendDstAlpha: "ZERO", // BLEND_DST_ALPHA
    blendDstRGB: "ZERO", // BLEND_DST_RGB
    blendEquationAlpha: "FUNC_ADD", // BLEND_EQUATION_ALPHA
    blendEquationRGB: "FUNC_ADD", // BLEND_EQUATION_RGB
    blendSrcAlpha: "ONE", // BLEND_EQUATION_ALPHA
    blendSrcRGB: "ONE", // BLEND_SRC_RGB

    cullEnable: false, // CULL_FACE
    cullMode: "BACK", // CULL_FACE_MODE
    cullFrontFace: "CCW", // FRONT_FACE

    depthTest: false, // DEPTH_TEST
    depthFunc: "LESS", // DEPTH_FUNC
    depthWriteMask: true, // DEPTH_WRITEMASK
    depthRange: [0, 1], // DEPTH_RANGE

    ditherEnable: true, // DITHER

    colorMask: [true, true, true, true],

    polygonOffsetFill: false, // POLYGON_OFFSET_FILL
    polygonOffsetFactor: 0, // POLYGON_OFFSET_FACTOR
    polygonOffsetUnits: 0, // POLYGON_OFFSET_UNITS

    sampleAlphaToCoverage: false, // SAMPLE_ALPHA_TO_COVERAGE
    sampleCoverage: false, // SAMPLE_COVERAGE
    sampleCoverageValue: 1, // SAMPLE_COVERAGE_VALUE
    sampleCoverageInvert: false, // SAMPLE_COVERAGE_INVERT

    stencilTest: false, // STENCIL_TEST
    stencilFunc: "ALWAYS", // STENCIL_FUNC
    stencilValueMask: 0x7FFFFFFF, // STENCIL_VALUE_MASK
    stencilRef: 0, // STENCIL_REF
    stencilBackFunc: "ALWAYS", // STENCIL_BACK_FUNC
    stencilBackValueMask: 0x7FFFFFFF, // STENCIL_BACK_VALUE_MASK
    stencilBackRef: 0, // STENCIL_BACK_REF
    viewport: { // VIEWPORT
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    } as Rect,

    scissorTest: false, // SCISSOR_TEST
    scissorBox: { // SCISSOR_BOX
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    } as Rect,

    rasterizerDiscard: false, // RASTERIZER_DISCARD

    frameBuffer: null,
    vertexArrayObject: null,

    program: null,
    uniformBuffers: [], // max length: MAX_UNIFORM_BUFFER_BINDINGS
} as const;
