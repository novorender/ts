// blit

export interface BlitParams {
    readonly source: WebGLFramebuffer | null;
    readonly destination: WebGLFramebuffer | null;

    readonly color?: true;
    readonly depth?: true;
    readonly stencil?: true;

    readonly filter?: "NEAREST" | "LINEAR"; // "NEAREST"

    readonly srcX0?: number; // default: 0
    readonly srcY0?: number; // default: 0
    readonly srcX1?: number; // default: width
    readonly srcY1?: number; // default: height

    readonly dstX0?: number; // default: 0
    readonly dstY0?: number; // default: 0
    readonly dstX1?: number; // default: width
    readonly dstY1?: number; // default: height
}


// buffer

export type BufferParams = BufferParamsSize | BufferParamsData;

export type BufferTargetString = "ARRAY_BUFFER" | "ELEMENT_ARRAY_BUFFER" | "COPY_READ_BUFFER" | "COPY_WRITE_BUFFER" | "TRANSFORM_FEEDBACK_BUFFER" | "UNIFORM_BUFFER" | "PIXEL_PACK_BUFFER" | "PIXEL_UNPACK_BUFFER";
export type BufferUsageString = "STATIC_DRAW" | "DYNAMIC_DRAW" | "STREAM_DRAW" | "STATIC_READ" | "DYNAMIC_READ" | "STREAM_READ" | "STATIC_COPY" | "DYNAMIC_COPY" | "STREAM_COPY";

export interface BufferParamsSize {
    /** X */
    readonly kind: BufferTargetString;
    readonly size: GLsizeiptr;
    readonly usage?: BufferUsageString; // default: "STATIC_DRAW"
}

export interface BufferParamsData {
    /** X */
    readonly kind: BufferTargetString;
    readonly srcData: BufferSource;
    readonly usage?: BufferUsageString; // default: "STATIC_DRAW"
}


// clear

export type ClearParams = ClearParamsBack | ClearParamsColor | ClearDepth | ClearStencil | ClearDepthStencil;

export interface ClearParamsBack {
    /** Clear the default back buffer provided by the canvas.
     * @remarks Equivalent to `gl.clearColor(...color); gl.clear(gl.COLOR_BUFFER_BIT);`
    */
    readonly kind?: "BACK";
    readonly color?: readonly [red: number, green: number, blue: number, alpha: number]; // default: [0, 0, 0, 1]
}

export interface ClearParamsColor {
    /** Clear a draw buffer.
     * @remarks Equivalent to `gl.clearBuffer[fiuv](color);`
    */
    readonly kind: "COLOR";
    readonly drawBuffer?: number; // 0 - MAX_DRAW_BUFFERS
    readonly color?: readonly [red: number, green: number, blue: number, alpha: number]; // default: [0, 0, 0, 1]
    readonly type?: "Int" | "Uint" | "Float"; // default: Float
}

export interface ClearDepth {
    readonly kind: "DEPTH";
    readonly depth: number;
}
export interface ClearStencil {
    readonly kind: "STENCIL";
    readonly stencil: number;
}
export interface ClearDepthStencil {
    readonly kind: "DEPTH_STENCIL";
    readonly depth: number;
    readonly stencil: number;
}


// copy

export interface CopyParams {
    readonly readBuffer: WebGLBuffer;
    readonly writeBuffer: WebGLBuffer;
    readonly readOffset?: number; // default: 0
    readonly writeOffset?: number; // default: 0
    readonly size: number;
}


// update

export interface UpdateParams {
    readonly target: BufferTargetString;
    readonly srcData: BufferSource;
    readonly targetBuffer: WebGLBuffer;
    readonly srcOffset?: number; // default: 0
    readonly targetOffset?: number; // default: 0
    readonly size?: number; // default: 0, which will copy entire srcData
}


// draw

export type DrawParams =
    DrawParamsArrays | DrawParamsArraysMultiDraw | DrawParamsArraysInstanced |
    DrawParamsElements | DrawParamsElementsRange | DrawParamsElementsInstanced;

export type DrawMode = "POINTS" | "LINE_STRIP" | "LINE_LOOP" | "LINES" | "TRIANGLE_STRIP" | "TRIANGLE_FAN" | "TRIANGLES";

export interface DrawParamsBase {
    readonly mode?: DrawMode; // default: TRIANGLES
}

export interface DrawParamsArrays extends DrawParamsBase {
    /** Equivalent to gl.drawArrays() */
    readonly kind: "arrays",
    readonly count: number;
    readonly first?: number; // default: 0
}

export interface DrawParamsArraysMultiDraw extends DrawParamsBase {
    /** Equivalent to `ext.multiDrawArraysWEBGL()` */
    readonly kind: "arrays_multidraw",
    readonly drawCount: number;
    readonly firstsList: Int32Array;
    readonly firstsOffset?: number; // default: 0
    readonly countsList: Int32Array;
    readonly countsOffset?: number; // default: 0
}

export interface DrawParamsElements extends DrawParamsBase {
    /** Equivalent to gl.drawElements() */
    readonly kind: "elements",
    /** # of indices to draw */
    readonly count: number;
    /** Type of indices */
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    /** Byte offset in the element array buffer. Must be a valid multiple of the size of the given type. */
    readonly offset?: number; // default: 0
}

export interface DrawParamsElementsRange extends DrawParamsBase {
    /** Equivalent to gl.drawRangeElements() */
    readonly kind: "elements_range",
    /** # of indices to draw */
    readonly count: number;
    /** Type of indices */
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    /** Byte offset in the element array buffer. Must be a valid multiple of the size of the given type. */
    readonly offset?: number; // default: 0
    /** The minimum array index contained in buffer range. */
    readonly minIndex: number; // start vertex index
    /** The maximum array index contained in buffer range. */
    readonly maxIndex: number; // end vertex index
}

export interface DrawParamsArraysInstanced extends DrawParamsBase {
    /** Equivalent to gl.drawArraysInstanced() */
    readonly kind: "arrays_instanced",
    readonly count: number;
    readonly instanceCount: number;
    readonly first?: number; // default: 0
}

export interface DrawParamsElementsInstanced extends DrawParamsBase {
    /** Equivalent to gl.drawElementsInstanced() */
    readonly kind: "elements_instanced",
    readonly count: number;
    readonly instanceCount: number;
    readonly indexType: "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
    readonly offset?: number; // default: 0
}


// framebuffer

export interface FrameBufferParams {
    readonly depth?: FrameBufferBinding;
    readonly stencil?: FrameBufferBinding;
    readonly color: readonly (FrameBufferBinding | null)[]; // length: [0, MAX_COLOR_ATTACHMENTS>
}

export interface FrameBufferTextureBinding {
    readonly texture: WebGLTexture;
    readonly target?: "TEXTURE_2D";
    readonly level?: number; // default: 0, mip-map level
    readonly layer?: number; // default: 0, face in cube map, z in 3d and index in 2d array
}

export interface FrameBufferRenderBufferBinding {
    readonly renderBuffer: WebGLRenderbuffer;
}

export interface InvalidateFrameBufferParams {
    readonly frameBuffer: WebGLFramebuffer;
    readonly depth?: boolean;
    readonly stencil?: boolean;
    readonly color: readonly (boolean)[]; // length: [0, MAX_COLOR_ATTACHMENTS>
}

export type FrameBufferBinding = FrameBufferTextureBinding | FrameBufferRenderBufferBinding;


//  program

export interface ProgramParams {
    readonly vertexShader: string;
    readonly fragmentShader?: string;
    readonly flags?: readonly string[];
    readonly transformFeedback?: {
        readonly bufferMode: "INTERLEAVED_ATTRIBS" | "SEPARATE_ATTRIBS";
        readonly varyings: readonly string[];
    }
}


// read

export interface ReadPixelsParams {
    readonly x: number;
    readonly y: number;
    readonly width?: number; // default: 1
    readonly height?: number; // default: 1
    readonly buffer?: AttachmentType; // default: BACK
    readonly format?: PixelFormat; // default: RGBA
    readonly type?: PixelType; // default: UNSIGNED_BYTE
}

export type AttachmentType = "BACK" | `COLOR_ATTACHMENT${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15}`;
export type PixelFormat = "ALPHA" | "RGB" | "RGBA" | "RED" | "RG" | "RED_INTEGER" | "RG_INTEGER" | "RGB_INTEGER" | "RGBA_INTEGER";
export type PixelType = "UNSIGNED_BYTE" | "UNSIGNED_SHORT_5_6_5" | "UNSIGNED_SHORT_4_4_4_4" | "UNSIGNED_SHORT_5_5_5_1" | "FLOAT" | "BYTE" | "UNSIGNED_INT_2_10_10_10_REV" | "HALF_FLOAT" | "SHORT" | "UNSIGNED_SHORT" | "INT" | "UNSIGNED_INT" | "UNSIGNED_INT_10F_11F_11F_REV" | "UNSIGNED_INT_10F_11F_11F_REV";
export type Pixels = Float32Array | Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array;

// renderBuffer

export type RenderBufferFormat =
    "R8" | "R8UI" | "R8I" | "R16UI" | "R16I" | "R32UI" | "R32I" |
    "RG8" | "RG8UI" | "RG8I" | "RG16UI" | "RG16I" | "RG32UI" | "RG32I" | "RGB8" |
    "RGBA8" | "SRGB8_ALPHA8" | "RGBA4" | "RGB565" | "RGB5_A1" | "RGB10_A2" | "RGBA8UI" | "RGBA8I" | "RGB10_A2UI" | "RGBA16UI" | "RGBA16I" | "RGBA32I" | "RGBA32UI" |
    "DEPTH_COMPONENT16" | "DEPTH_COMPONENT24" | "DEPTH_COMPONENT32F" | "DEPTH_STENCIL" | "DEPTH24_STENCIL8" | "DEPTH32F_STENCIL8" | "STENCIL_INDEX8";

export interface RenderBufferParams {
    readonly internalFormat: RenderBufferFormat;
    readonly width: number;
    readonly height: number;
    readonly samples?: number | "max"; // default: undefined (single sampled)
};


// sampler

export type WrapString = "CLAMP_TO_EDGE" | "MIRRORED_REPEAT" | "REPEAT";
export type MinFilterString = "NEAREST" | "LINEAR" | "NEAREST_MIPMAP_NEAREST" | "LINEAR_MIPMAP_NEAREST" | "NEAREST_MIPMAP_LINEAR" | "LINEAR_MIPMAP_LINEAR";
export type MagFilterString = "NEAREST" | "LINEAR";
export type CompareFuncString = "NEVER" | "LESS" | "EQUAL" | "LEQUAL" | "GREATER" | "NOTEQUAL" | "GEQUAL" | "ALWAYS";
export type CompareModeString = "COMPARE_REF_TO_TEXTURE" | "NONE";

export interface SamplerParams {
    readonly minificationFilter?: MinFilterString; // default: NEAREST_MIPMAP_LINEAR
    readonly magnificationFilter?: MagFilterString; // default: LINEAR
    readonly minLOD?: number; // default: -1000
    readonly maxLOD?: number; // default: 1000
    readonly compareFunction?: CompareFuncString;
    readonly compareMode?: CompareModeString;
    readonly wrap?: readonly [WrapString, WrapString] | readonly [WrapString, WrapString, WrapString]; // ST, or STR coordinate wrapping. default: REPEAT
};


// transform feedback

export type TransformFeedbackPrimitiveMode = "POINTS" | "LINES" | "TRIANGLES";
export interface TransformFeedbackParams {
    readonly primitiveMode: TransformFeedbackPrimitiveMode;
    readonly outputBuffers: readonly WebGLBuffer[];
}
export interface TransformFeedbackTestParams {
    readonly expectedResult: BufferSource;
}


// state

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

    // readonly arrayBuffer: WebGLBuffer | null; // ARRAY_BUFFER
    // readonly elementArrayBuffer: WebGLBuffer | null; // ELEMENT_ARRAY_BUFFER
    readonly frameBuffer: WebGLFramebuffer | null;
    readonly vertexArrayObject: WebGLVertexArrayObject | null;

    readonly program: WebGLProgram | null;
    readonly uniformBuffers: readonly UniformBufferBinding[]; // max length: MAX_UNIFORM_BUFFER_BINDINGS
    readonly uniforms: readonly UniformBinding[];

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
    readonly name: string;
    readonly value: number;
}

export interface UniformBindingVector {
    readonly kind: UniformTypeVector;
    readonly name: string;
    readonly value: readonly number[];
}

export interface UniformBindingMatrix {
    readonly kind: UniformTypeMatrix;
    readonly name: string;
    readonly value: readonly number[];
    readonly transpose?: boolean; // default: false
}

export type UniformBinding = UniformBindingScalar | UniformBindingVector | UniformBindingMatrix;

export interface UniformBufferBindingBase {
    readonly name?: string;
    readonly buffer: WebGLBuffer | null;
}

export interface UniformBufferBindingRange extends UniformBufferBindingBase {
    readonly offset: number;
    readonly size: number;
}

export type UniformBufferBinding = UniformBufferBindingBase | UniformBufferBindingRange;

export interface TextureBinding {
    readonly target: "TEXTURE_2D" | "TEXTURE_3D" | "TEXTURE_2D_ARRAY" | "TEXTURE_CUBE_MAP";
    readonly texture: WebGLTexture;
    readonly sampler: WebGLSampler;
}


// texture

export type TextureParams =
    TextureParams2DUncompressed | TextureParams2DCompressed | TextureParams2DUncompressedMipMapped | TextureParams2DCompressedMipMapped |
    TextureParamsCubeUncompressed | TextureParamsCubeCompressed | TextureParamsCubeUncompressedMipMapped | TextureParamsCubeCompressedMipMapped |
    TextureParams3DUncompressed | TextureParams3DCompressed | TextureParams3DUncompressedMipMapped | TextureParams3DCompressedMipMapped |
    TextureParams2DArrayUncompressed | TextureParams2DArrayCompressed | TextureParams2DArrayUncompressedMipMapped | TextureParams2DArrayCompressedMipMapped;


// 2D
export interface TextureParams2DUncompressed extends Uncompressed, Size2D, GenMipMap {
    readonly kind: "TEXTURE_2D";
    readonly image: BufferSource | null;
};

export interface TextureParams2DCompressed extends Compressed, Size2D {
    readonly kind: "TEXTURE_2D";
    readonly image: BufferSource;
};

export interface TextureParams2DUncompressedMipMapped extends Uncompressed, Size2D<Pow2>, GenMipMap {
    readonly kind: "TEXTURE_2D";
    readonly mipMaps: readonly (BufferSource | null)[];
};

export interface TextureParams2DCompressedMipMapped extends Compressed, Size2D<Pow2> {
    readonly kind: "TEXTURE_2D";
    readonly mipMaps: readonly (BufferSource)[];
};

// Cube
export interface TextureParamsCubeUncompressed extends Uncompressed, Size2D, GenMipMap {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly image: CubeImages | null;
}

export interface TextureParamsCubeCompressed extends Compressed, Size2D {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly image: CubeImages;
}

export interface TextureParamsCubeUncompressedMipMapped extends Uncompressed, Size2D<Pow2> {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly mipMaps: readonly (CubeImages | null)[];
}

export interface TextureParamsCubeCompressedMipMapped extends Compressed, Size2D<Pow2> {
    readonly kind: "TEXTURE_CUBE_MAP";
    readonly mipMaps: readonly (CubeImages)[];
}

// 3D
export interface TextureParams3DUncompressed extends Uncompressed, Size3D, GenMipMap {
    readonly kind: "TEXTURE_3D";
    readonly image: BufferSource;
}

export interface TextureParams3DCompressed extends Compressed, Size3D {
    readonly kind: "TEXTURE_3D";
    readonly image: BufferSource;
}

export interface TextureParams3DUncompressedMipMapped extends Uncompressed, Size3D<Pow2> {
    readonly kind: "TEXTURE_3D";
    readonly mipMaps: readonly (BufferSource | null)[];
}

export interface TextureParams3DCompressedMipMapped extends Compressed, Size3D<Pow2> {
    readonly kind: "TEXTURE_3D";
    readonly mipMaps: readonly (BufferSource)[];
}

// 2D Array
export interface TextureParams2DArrayUncompressed extends Uncompressed, Size3D, GenMipMap {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly image: BufferSource | null;
}

export interface TextureParams2DArrayCompressed extends Compressed, Size3D {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly image: BufferSource;
}

export interface TextureParams2DArrayUncompressedMipMapped extends Uncompressed, Size3D<Pow2> {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly mipMaps: readonly (BufferSource | null)[];
}

export interface TextureParams2DArrayCompressedMipMapped extends Compressed, Size3D<Pow2> {
    readonly kind: "TEXTURE_2D_ARRAY";
    readonly mipMaps: readonly (BufferSource)[];
}

export type TextureImageTargetString = "TEXTURE_2D" | "TEXTURE_3D" | "TEXTURE_2D_ARRAY" | "TEXTURE_CUBE_MAP_POSITIVE_X" | "TEXTURE_CUBE_MAP_NEGATIVE_X" | "TEXTURE_CUBE_MAP_POSITIVE_Y" | "TEXTURE_CUBE_MAP_NEGATIVE_Y" | "TEXTURE_CUBE_MAP_POSITIVE_Z" | "TEXTURE_CUBE_MAP_NEGATIVE_Z";

export type TexelTypeString =
    "UNSIGNED_BYTE" | "UNSIGNED_SHORT_5_6_5" | "UNSIGNED_SHORT_4_4_4_4" | "UNSIGNED_SHORT_5_5_5_1" |
    "BYTE" | "UNSIGNED_SHORT" | "SHORT" | "UNSIGNED_INT" | "INT" | "HALF_FLOAT" | "FLOAT" |
    "UNSIGNED_INT_2_10_10_10_REV" | "UNSIGNED_INT_10F_11F_11F_REV" | "UNSIGNED_INT_5_9_9_9_REV" | "UNSIGNED_INT_24_8" | "FLOAT_32_UNSIGNED_INT_24_8_REV";

export type UncompressedTextureFormatString =
    // "ALPHA" | "RGB" | "RGBA" | "LUMINANCE" | "LUMINANCE_ALPHA" |
    "R8" | "R8_SNORM" | "RG8" | "RG8_SNORM" | "RGB8" | "RGB8_SNORM" |
    "RGB565" | "RGBA4" | "RGB5_A1" |
    "RGBA8" | "RGBA8_SNORM" |
    "RGB10_A2" | "RGB10_A2UI" |
    "SRGB8" | "SRGB8_ALPHA8" |
    "R16F" | "RG16F" | "RGB16F" | "RGBA16F" |
    "R32F" | "RG32F" | "RGB32F" | "RGBA32F" |
    "R11F_G11F_B10F" | "RGB9_E5" |
    "R8I" | "R8UI" |
    "R16I" | "R16UI" |
    "R32I" | "R32UI" |
    "RG8I" | "RG8UI" |
    "RG16I" | "RG16UI" |
    "RG32I" | "RG32UI" |
    "RGB8I" | "RGB8UI" |
    "RGB16I" | "RGB16UI" |
    "RGB32I" | "RGB32UI" |
    "RGBA8I" | "RGBA8UI" |
    "RGBA16I" | "RGBA16UI" |
    "RGBA32I" | "RGBA32UI";

export type CompressedTextureFormatString =
    // WEBGL_compressed_texture_s3tc
    "COMPRESSED_RGB_S3TC_DXT1_EXT" | "COMPRESSED_RGBA_S3TC_DXT1_EXT" | "COMPRESSED_RGBA_S3TC_DXT3_EXT" | "COMPRESSED_RGBA_S3TC_DXT5_EXT" |

    // WEBGL_compressed_texture_s3tc_srgb    
    "COMPRESSED_SRGB_S3TC_DXT1_EXT" | "COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT" | "COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT" | "COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT" |

    // WEBGL_compressed_texture_etc
    "COMPRESSED_R11_EAC" | "COMPRESSED_SIGNED_R11_EAC" | "COMPRESSED_RG11_EAC" | "COMPRESSED_SIGNED_RG11_EAC" | "COMPRESSED_RGB8_ETC2" | "COMPRESSED_RGBA8_ETC2_EAC" | "COMPRESSED_SRGB8_ETC2" | "COMPRESSED_SRGB8_ALPHA8_ETC2_EAC" | "COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2" | "COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2" |

    // WEBGL_compressed_texture_pvrtc
    "COMPRESSED_RGB_PVRTC_4BPPV1_IMG" | "COMPRESSED_RGBA_PVRTC_4BPPV1_IMG" | "COMPRESSED_RGB_PVRTC_2BPPV1_IMG" | "COMPRESSED_RGBA_PVRTC_2BPPV1_IMG" |

    // WEBGL_compressed_texture_etc1
    "COMPRESSED_RGB_ETC1_WEBGL" |

    // WEBGL_compressed_texture_astc    
    "COMPRESSED_RGBA_ASTC_4x4_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR" |
    "COMPRESSED_RGBA_ASTC_5x4_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR" |
    "COMPRESSED_RGBA_ASTC_5x5_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR" |
    "COMPRESSED_RGBA_ASTC_6x5_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR" |
    "COMPRESSED_RGBA_ASTC_6x6_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR" |
    "COMPRESSED_RGBA_ASTC_8x5_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR" |
    "COMPRESSED_RGBA_ASTC_8x6_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR" |
    "COMPRESSED_RGBA_ASTC_8x8_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR" |
    "COMPRESSED_RGBA_ASTC_10x5_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR" |
    "COMPRESSED_RGBA_ASTC_10x6_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR" |
    "COMPRESSED_RGBA_ASTC_10x10_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR" |
    "COMPRESSED_RGBA_ASTC_12x10_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR" |
    "COMPRESSED_RGBA_ASTC_12x12_KHR" | "COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR" |

    // EXT_texture_compression_bptc
    "COMPRESSED_RGBA_BPTC_UNORM_EXT" | "COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT" | "COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT" | "COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT" |

    // EXT_texture_compression_rgtc
    "COMPRESSED_RED_RGTC1_EXT" | "COMPRESSED_SIGNED_RED_RGTC1_EXT" | "COMPRESSED_RED_GREEN_RGTC2_EXT" | "COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT";

type Pow2 = 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 | 8192 | 16384 | 32758 | 65536;
type CubeImages = readonly [posX: BufferSource, negX: BufferSource, posY: BufferSource, negZ: BufferSource, posZ: BufferSource, negZ: BufferSource];

interface Uncompressed {
    readonly internalFormat: UncompressedTextureFormatString;
    readonly type: Exclude<TexelTypeString, "FLOAT_32_UNSIGNED_INT_24_8_REV">; // FLOAT_32_UNSIGNED_INT_24_8_REV is for reading z-buffer and can't be created from an image: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/texImage3D
}

interface Compressed {
    readonly internalFormat: CompressedTextureFormatString;
}

interface GenMipMap {
    readonly generateMipMaps?: boolean; //  default: false. Mip maps can only be created for textures with power of 2 sizes.
}

interface Size2D<T extends number = number> {
    readonly width: T;
    readonly height: T;
}

interface Size3D<T extends number = number> {
    readonly width: T;
    readonly height: T;
    readonly depth: T;
}

/// vao

export interface VertexArrayParams {
    readonly attributes: readonly (VertexAttribute | null)[];
    readonly indices?: WebGLBuffer;
}

export type VertexAttribute = VertexAttributeFloat | VertexAttributeFloatNormalized | VertexAttributeInt | VertexAttributeUint;

export type ComponentTypeFloat = "HALF_FLOAT" | "FLOAT";
export type ComponentTypeInt = "BYTE" | "SHORT" | "INT";
export type ComponentTypeUint = "UNSIGNED_BYTE" | "UNSIGNED_SHORT" | "UNSIGNED_INT";
export type ShaderTypeFloat = "FLOAT" | "FLOAT_VEC2" | "FLOAT_VEC3" | "FLOAT_VEC4" |
    // we allow matrix types as a convenience because gl.getActiveAttrib() could return such a type from a shader program.
    // each matrix row still has to be bound separately when defining attributes.
    "FLOAT_MAT2" | "FLOAT_MAT3" | "FLOAT_MAT4" | "FLOAT_MAT2x3" | "FLOAT_MAT2x4" | "FLOAT_MAT3x2" | "FLOAT_MAT3x4" | "FLOAT_MAT4x2" | "FLOAT_MAT4x3";
export type ShaderTypeInt = "INT" | "INT_VEC2" | "INT_VEC3" | "INT_VEC4";
export type ShaderTypeUint = "UNSIGNED_INT" | "UNSIGNED_INT_VEC2" | "UNSIGNED_INT_VEC3" | "UNSIGNED_INT_VEC4";
export type ShaderAttributeType = ShaderTypeFloat | ShaderTypeInt | ShaderTypeUint;

interface VertexAttributeCommon {
    readonly buffer: WebGLBuffer;
    readonly componentCount?: 1 | 2 | 3 | 4; // default: same as shader type
    readonly stride?: number; // default: 0
    readonly offset?: number; // default: 0
    readonly divisor?: number; // default: 0
}

export interface VertexAttributeFloat extends VertexAttributeCommon {
    readonly kind: ShaderTypeFloat;
    readonly componentType?: ComponentTypeFloat | ComponentTypeInt | ComponentTypeUint; // default: FLOAT
    readonly normalized?: false;
}

export interface VertexAttributeFloatNormalized extends VertexAttributeCommon {
    readonly kind: ShaderTypeFloat;
    readonly componentType?: ComponentTypeInt | ComponentTypeUint; // default: FLOAT
    readonly normalized: true;
}

export interface VertexAttributeInt extends VertexAttributeCommon {
    readonly kind: ShaderTypeInt;
    readonly componentType?: ComponentTypeInt; // default: INT
    readonly normalized?: undefined;
}

export interface VertexAttributeUint extends VertexAttributeCommon {
    readonly kind: ShaderTypeUint;
    readonly componentType?: ComponentTypeUint; // default: UNSIGNED_INT
    readonly normalized?: undefined;
}
