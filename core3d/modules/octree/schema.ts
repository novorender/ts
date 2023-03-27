import { BufferReader } from "./util.js";
import type { EnumArray, U8, U16, U32, I8, I16, I32, F16, F32, F64 } from "./util.js";

// Type of GL render primitive.
export const enum PrimitiveType {
    points = 0,
    lines = 1,
    line_loops = 2,
    line_strip = 3,
    triangles = 4,
    triangle_strip = 5,
    triangle_fan = 6,
};

// Bitwise flags for which vertex attributes will be used in geometry.
export const enum OptionalVertexAttribute {
    normal = 1,
    color = 2,
    texCoord = 4,
};

// Type of material.
export const enum MaterialType {
    opaque = 0,
    opaqueDoubleSided = 1,
    transparent = 2,
    elevation = 3,
};

// Texture semantic/purpose.
export const enum TextureSemantic {
    baseColor = 0,
};

// Range into submesh projection.
export interface SubMeshProjectionRange { readonly start: U32; readonly count: U32; };

// Mesh vertices
export interface VertexRange { readonly start: U32; readonly count: U32; };

// Mesh vertex indices
export interface VertexIndexRange { readonly start: U32; readonly count: U32; };

// Mesh Textures
export interface TextureInfoRange { readonly start: U8; readonly count: U8; };

// Range into texture pixel blob.
export interface PixelRange { readonly start: U32; readonly count: U32; };

// Information about child nodes.
export interface ChildInfo {
    readonly length: number;
    readonly childIndex: U8;
    readonly childMask: U32; // Set of bits (max 32) for which child indices are referenced by geometry.
    readonly tolerance: I8; // A power of two exponent describing the error tolerance of this node, which is used to determine LOD.
    readonly nodeSize: F32; // Used to determine LOD based on projected size of node.
    readonly totalByteSize: U32; // # uncompressed bytes total for child binary file.
    readonly offset: Double3; // Model -> world space translation vector.
    readonly scale: F32; // Model -> world space uniform scale factor (from unit [-1,1] vectors).
    readonly bounds: Bounds; // Bounding volume (in model space).
    readonly subMeshes: SubMeshProjectionRange;
};

export interface Double3 {
    readonly length: number;
    readonly x: F64;
    readonly y: F64;
    readonly z: F64;
};

// Node bounding volume.
export interface Bounds {
    readonly length: number;
    readonly box: AABB;
    readonly sphere: BoundingSphere;
};

// Axis aligned bounding box.
export interface AABB {
    readonly length: number;
    readonly min: Float3;
    readonly max: Float3;
};

export interface Float3 {
    readonly length: number;
    readonly x: F32;
    readonly y: F32;
    readonly z: F32;
};

// Bounding sphere.
export interface BoundingSphere {
    readonly length: number;
    readonly origo: Float3;
    readonly radius: F32;
};

// Information about child sub meshes used to predict cost before loading.
export interface SubMeshProjection {
    readonly length: number;
    readonly objectId: U32;
    readonly primitiveType: EnumArray<PrimitiveType>;
    readonly attributes: EnumArray<OptionalVertexAttribute>;
    readonly numDeviations: U8; // # of deviation vertex attributes (0-3)
    readonly numIndices: U32; // zero if no index buffer
    readonly numVertices: U32;
    readonly numTextureBytes: U32;
};

// Groups of 3D primitives with common attributes. These can further be split up to form e.g. 64K chunks for 16 bit indexing, i.e. there can be many submeshes with the same attributes. Groups are ordered by child, object and material indices.
export interface SubMesh {
    readonly length: number;
    readonly childIndex: U8;
    readonly objectId: U32;
    readonly materialIndex: U8;
    readonly primitiveType: EnumArray<PrimitiveType>;
    readonly materialType: EnumArray<MaterialType>;
    readonly attributes: EnumArray<OptionalVertexAttribute>;
    readonly numDeviations: U8; // # of deviation vertex attributes (0-4)
    readonly vertices: VertexRange; // Vertices are local to each sub-mesh.
    readonly primitiveVertexIndices: VertexIndexRange; // Triangle vertex index triplets, or line index pairs, if any, are 16-bit and relative to the local vertex range.
    readonly edgeVertexIndices: VertexIndexRange; // "Hard" edge vertex index pairs, if any, are 16-bit and relative to the local vertex range.
    readonly cornerVertexIndices: VertexIndexRange; // "Hard" corner vertex indices, if any, are 16-bit and relative to the local vertex range.
    readonly textures: TextureInfoRange;
};

export interface TextureInfo {
    readonly length: number;
    readonly semantic: EnumArray<TextureSemantic>;
    readonly transform: Float3x3;
    readonly pixelRange: PixelRange;
};

// 3x3 row major matrix
export interface Float3x3 {
    readonly length: number;
    readonly e00: F32;
    readonly e01: F32;
    readonly e02: F32;
    readonly e10: F32;
    readonly e11: F32;
    readonly e12: F32;
    readonly e20: F32;
    readonly e21: F32;
    readonly e22: F32;
};

// Mesh vertices
export interface Vertex {
    readonly length: number;
    readonly position: Int16_3;
    readonly normal?: Int8_3;
    readonly color?: RGBA_U8;
    readonly texCoord?: Half2;
    readonly deviations: Deviations;
};

export interface Int16_3 {
    readonly length: number;
    readonly x: I16;
    readonly y: I16;
    readonly z: I16;
};

export interface Int8_3 {
    readonly length: number;
    readonly x: I8;
    readonly y: I8;
    readonly z: I8;
};

export interface RGBA_U8 {
    readonly length: number;
    readonly red: U8;
    readonly green: U8;
    readonly blue: U8;
    readonly alpha: U8;
};

export interface Half2 {
    readonly length: number;
    readonly x: F16;
    readonly y: F16;
};

// Mesh deviations vertex attributes
export interface Deviations {
    readonly length: number;
    readonly a?: F16;
    readonly b?: F16;
    readonly c?: F16;
    readonly d?: F16;
};

// Mesh triangles
export interface Triangle {
    readonly length: number;
    readonly topologyFlags?: U8; // Bits [0-2] are edge flags (vertex pairs ab, bc, ca), [3-5] corner flags. True = edge/corner is a "hard", or true topological feature and should be rendered and/or snapped to.
};

export function readSchema(r: BufferReader) {
    const sizes = r.u32(8);
    const flags = r.u8(9);
    const schema = {
        childInfo: {
            length: sizes[0],
            childIndex: r.u8(sizes[0]),
            childMask: r.u32(sizes[0]),
            tolerance: r.i8(sizes[0]),
            nodeSize: r.f32(sizes[0]),
            totalByteSize: r.u32(sizes[0]),
            offset: {
                length: sizes[0],
                x: r.f64(sizes[0]),
                y: r.f64(sizes[0]),
                z: r.f64(sizes[0]),
            } as Double3,
            scale: r.f32(sizes[0]),
            bounds: {
                length: sizes[0],
                box: {
                    length: sizes[0],
                    min: {
                        length: sizes[0],
                        x: r.f32(sizes[0]),
                        y: r.f32(sizes[0]),
                        z: r.f32(sizes[0]),
                    } as Float3,
                    max: {
                        length: sizes[0],
                        x: r.f32(sizes[0]),
                        y: r.f32(sizes[0]),
                        z: r.f32(sizes[0]),
                    } as Float3,
                } as AABB,
                sphere: {
                    length: sizes[0],
                    origo: {
                        length: sizes[0],
                        x: r.f32(sizes[0]),
                        y: r.f32(sizes[0]),
                        z: r.f32(sizes[0]),
                    } as Float3,
                    radius: r.f32(sizes[0]),
                } as BoundingSphere,
            } as Bounds,
            subMeshes: { start: r.u32(sizes[0]), count: r.u32(sizes[0]) } as SubMeshProjectionRange,
        } as ChildInfo,
        subMeshProjection: {
            length: sizes[1],
            objectId: r.u32(sizes[1]),
            primitiveType: r.u8(sizes[1]) as EnumArray<PrimitiveType>,
            attributes: r.u8(sizes[1]) as EnumArray<OptionalVertexAttribute>,
            numDeviations: r.u8(sizes[1]),
            numIndices: r.u32(sizes[1]),
            numVertices: r.u32(sizes[1]),
            numTextureBytes: r.u32(sizes[1]),
        } as SubMeshProjection,
        subMesh: {
            length: sizes[2],
            childIndex: r.u8(sizes[2]),
            objectId: r.u32(sizes[2]),
            materialIndex: r.u8(sizes[2]),
            primitiveType: r.u8(sizes[2]) as EnumArray<PrimitiveType>,
            materialType: r.u8(sizes[2]) as EnumArray<MaterialType>,
            attributes: r.u8(sizes[2]) as EnumArray<OptionalVertexAttribute>,
            numDeviations: r.u8(sizes[2]),
            vertices: { start: r.u32(sizes[2]), count: r.u32(sizes[2]) } as VertexRange,
            primitiveVertexIndices: { start: r.u32(sizes[2]), count: r.u32(sizes[2]) } as VertexIndexRange,
            edgeVertexIndices: { start: r.u32(sizes[2]), count: r.u32(sizes[2]) } as VertexIndexRange,
            cornerVertexIndices: { start: r.u32(sizes[2]), count: r.u32(sizes[2]) } as VertexIndexRange,
            textures: { start: r.u8(sizes[2]), count: r.u8(sizes[2]) } as TextureInfoRange,
        } as SubMesh,
        textureInfo: {
            length: sizes[3],
            semantic: r.u8(sizes[3]) as EnumArray<TextureSemantic>,
            transform: {
                length: sizes[3],
                e00: r.f32(sizes[3]),
                e01: r.f32(sizes[3]),
                e02: r.f32(sizes[3]),
                e10: r.f32(sizes[3]),
                e11: r.f32(sizes[3]),
                e12: r.f32(sizes[3]),
                e20: r.f32(sizes[3]),
                e21: r.f32(sizes[3]),
                e22: r.f32(sizes[3]),
            } as Float3x3,
            pixelRange: { start: r.u32(sizes[3]), count: r.u32(sizes[3]) } as PixelRange,
        } as TextureInfo,
        vertex: {
            length: sizes[4],
            position: {
                length: sizes[4],
                x: r.i16(sizes[4]),
                y: r.i16(sizes[4]),
                z: r.i16(sizes[4]),
            } as Int16_3,
            normal: !flags[0] ? undefined : {
                length: sizes[4],
                x: r.i8(sizes[4]),
                y: r.i8(sizes[4]),
                z: r.i8(sizes[4]),
            } as Int8_3,
            color: !flags[1] ? undefined : {
                length: sizes[4],
                red: r.u8(sizes[4]),
                green: r.u8(sizes[4]),
                blue: r.u8(sizes[4]),
                alpha: r.u8(sizes[4]),
            } as RGBA_U8,
            texCoord: !flags[2] ? undefined : {
                length: sizes[4],
                x: r.f16(sizes[4]),
                y: r.f16(sizes[4]),
            } as Half2,
            deviations: {
                length: sizes[4],
                a: !flags[3] ? undefined : r.f16(sizes[4]),
                b: !flags[4] ? undefined : r.f16(sizes[4]),
                c: !flags[5] ? undefined : r.f16(sizes[4]),
                d: !flags[6] ? undefined : r.f16(sizes[4]),
            } as Deviations,
        } as Vertex,
        triangle: {
            length: sizes[5],
            topologyFlags: !flags[7] ? undefined : r.u8(sizes[5]),
        } as Triangle,
        vertexIndex: !flags[8] ? undefined : r.u16(sizes[6]),
        texturePixels: r.u8(sizes[7]),
    } as const;
    console.assert(r.eof);
    return schema;
}

export type Schema = ReturnType<typeof readSchema>;
