import type { RendererContext } from ".";
import type { AttributeDefault, ColorAttachment, Rect, State, StateParams, TextureBinding, UniformBinding, UniformBindingMatrix, UniformBindingScalar, UniformBindingVector, UniformBufferBindingRange } from "./types";
import type { LimitsGL } from "./context.js";

type FilteredKeys<T, U> = { [P in keyof T]: T[P] extends U ? P : never }[keyof T];

function isUniformBufferBindingRange(params: UniformBufferBindingRange | WebGLBuffer | null): params is UniformBufferBindingRange {
    return params != null && "offset" in params && "size" in params;
}

function isUniformScalar(params: UniformBinding): params is UniformBindingScalar {
    return params.kind.startsWith("1");
}

function isUniformVector(params: UniformBinding): params is UniformBindingVector {
    return params.kind[0] >= '2' && params.kind[0] <= '4';
}

function isUniformMatrix(params: UniformBinding): params is UniformBindingMatrix {
    return params.kind.startsWith("Matrix");
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

    // arrayBuffer: null, // ARRAY_BUFFER
    // elementArrayBuffer: null, // ELEMENT_ARRAY_BUFFER
    frameBuffer: null,
    vertexArrayObject: null,

    program: null,
    uniformBuffers: [], // max length: MAX_UNIFORM_BUFFER_BINDINGS
    uniforms: [],
} as const;

export function createDefaultState(limits: LimitsGL): State {
    return {
        ...defaultConstants,
        drawBuffers: ["BACK"] as ReadonlyArray<ColorAttachment | "BACK" | "NONE">,
        attributeDefaults: Array<AttributeDefault | null>(limits.MAX_VERTEX_ATTRIBS).fill({ type: "4f", values: [0, 0, 0, 1] }) as ReadonlyArray<AttributeDefault | null>,
        textures: Array<TextureBinding | null>(limits.MAX_COMBINED_TEXTURE_IMAGE_UNITS).fill(null) as ReadonlyArray<TextureBinding | null>,
    } as const;
}

export function setState(context: RendererContext, params: StateParams) {
    const { gl } = context;

    function setFlag(cap: FilteredKeys<WebGL2RenderingContext, number>, key: keyof StateParams) {
        const value = params[key];
        if (value !== undefined) {
            if (value) {
                gl.enable(gl[cap]);
            } else {
                gl.disable(gl[cap]);
            }
        }
    }

    function set(setter: (this: WebGLRenderingContext, ...values: any) => void, ...keys: readonly (keyof typeof defaultConstants)[]) {
        if (keys.some(key => params[key] !== undefined)) {
            const values = keys.map(key => {
                const v = params[key] ?? defaultConstants[key];
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

    const { /*arrayBuffer, elementArrayBuffer,*/ frameBuffer, vertexArrayObject, drawBuffers, attributeDefaults, textures, uniforms, uniformBuffers } = params;

    // if (arrayBuffer !== undefined) {
    //     gl.bindBuffer(gl.ARRAY_BUFFER, arrayBuffer);
    // }

    // if (elementArrayBuffer !== undefined) {
    //     gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elementArrayBuffer);
    // }

    if (vertexArrayObject !== undefined) {
        gl.bindVertexArray(vertexArrayObject);
    }

    if (frameBuffer !== undefined) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    }

    if (drawBuffers) {
        gl.drawBuffers(drawBuffers.map(b => gl[b]));
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
            gl.bindTexture(gl[binding?.target ?? "TEXTURE_2D"], texture);
            const sampler = binding?.sampler ?? null;
            gl.bindSampler(i, sampler);
        }
        gl.activeTexture(texture0);
    }

    const { program } = params;
    if (program !== undefined) {
        gl.useProgram(program);
    }

    if (uniforms) {
        for (const uniformParams of uniforms) {
            const { location } = uniformParams;
            if (isUniformScalar(uniformParams)) {
                gl[`uniform${uniformParams.kind}`](location, uniformParams.value);
            } else if (isUniformVector(uniformParams)) {
                gl[`uniform${uniformParams.kind}v`](location, uniformParams.value);
            } else if (isUniformMatrix(uniformParams)) {
                gl[`uniform${uniformParams.kind}v`](location, uniformParams.transpose ?? false, uniformParams.value);
            }
        }
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