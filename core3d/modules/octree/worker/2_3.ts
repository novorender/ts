// this file is auto generated - do not edit!
import { BufferReader } from "./util.js";
import type { EnumArray, U8, U16, U32, I8, I16, I32, F16, F32, F64 } from "./util.js";

export const version = "2.3";

// Type of GL render primitive.
export const enum PrimitiveType {
    points = 0,
    lines = 1,
    lineLoop = 2,
    lineStrip = 3,
    triangles = 4,
    triangleStrip = 5,
    triangleFan = 6,
};

// Bitwise flags for which vertex attributes will be used in geometry.
export const enum OptionalVertexAttribute {
    normal = 1,
    color = 2,
    texCoord = 4,
    projectedPos = 8,
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

// Hash bytes
export interface HashRange { readonly start: U32; readonly count: U32; };

// Range into submesh projection.
export interface SubMeshProjectionRange { readonly start: U32; readonly count: U32; };

// Range into descendantObjectIdsRange.
export interface DescendantObjectIdsRange { readonly start: U32; readonly count: U32; };

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
    readonly hash: HashRange; // Byte range into Hash bytes array. The hash, formatted as hex, is used for the filename of the child node.
    readonly childIndex: U8;
    readonly childMask: U32; // Set of bits (max 32) for which child indices are referenced by geometry.
    readonly tolerance: I8; // A power of two exponent describing the error tolerance of this node, which is used to determine LOD.
    readonly positionBPC: U8; // # bits per vertex position component (16/32).
    readonly totalByteSize: U32; // # uncompressed bytes total for child binary file.
    readonly offset: Double3; // Model -> world space translation vector.
    readonly scale: F32; // Model -> world space uniform scale factor (from unit [-1,1] vectors).
    readonly bounds: Bounds; // Bounding volume (in model space).
    readonly subMeshes: SubMeshProjectionRange;
    readonly descendantObjectIds: DescendantObjectIdsRange;
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
    readonly numPointFactors: U8; // # of point factor vertex attributes (0-8)
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
    readonly numDeviations: U8; // # of point deviations vertex attributes (0-6)
    readonly vertices: VertexRange; // Vertices are local to each sub-mesh.
    readonly primitiveVertexIndices: VertexIndexRange; // Triangle vertex index triplets, or line index pairs, if any, are 16-bit and relative to the local vertex range.
    readonly edgeVertexIndices: VertexIndexRange; // "Hard" edge vertex index pairs, if any, are 16-bit and relative to the local vertex range.
    readonly cornerVertexIndices: VertexIndexRange; // "Hard" corner vertex indices, if any, are 16-bit and relative to the local vertex range.
    readonly textures: TextureInfoRange;
    readonly pointSizeExp?: I8; // A power of two exponent describing the point size in meters
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
    readonly position16?: Int16_3;
    readonly position32?: Int32_3;
    readonly normal?: Int8_3;
    readonly color?: RGBA_U8;
    readonly texCoord?: Half2;
    readonly projectedPos16?: Int16_3;
    readonly projectedPos32?: Int32_3;
    readonly pointIntensity?: F16;
    readonly pointClassification?: F16;
    readonly pointDeviation0?: F16;
    readonly pointDeviation1?: F16;
    readonly pointDeviation2?: F16;
    readonly pointDeviation3?: F16;
    readonly pointDeviation4?: F16;
    readonly pointDeviation5?: F16;
};

export interface Int16_3 {
    readonly length: number;
    readonly x: I16;
    readonly y: I16;
    readonly z: I16;
};

export interface Int32_3 {
    readonly length: number;
    readonly x: I32;
    readonly y: I32;
    readonly z: I32;
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

// Mesh triangles
export interface Triangle {
    readonly length: number;
    readonly topologyFlags?: U8; // Bits [0-2] are edge flags (vertex pairs ab, bc, ca), and [3-5] are corner flags. True = edge/corner is a "hard", or true topological feature and should be rendered and/or snapped to.
};

export function readSchema(r: BufferReader) {
    const sizes = r.u32(11);
    const flags = r.u8(18);
    const schema = {
        version: "2.3",
        childInfo: {
            length: sizes[0],
            hash: { start: r.u32(sizes[0]), count: r.u32(sizes[0]) } as HashRange,
            childIndex: r.u8(sizes[0]),
            childMask: r.u32(sizes[0]),
            tolerance: r.i8(sizes[0]),
            positionBPC: r.u8(sizes[0]),
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
            descendantObjectIds: { start: r.u32(sizes[0]), count: r.u32(sizes[0]) } as DescendantObjectIdsRange,
        } as ChildInfo,
        hashBytes: r.u8(sizes[1]),
        descendantObjectIds: r.u32(sizes[2]),
        subMeshProjection: {
            length: sizes[3],
            objectId: r.u32(sizes[3]),
            primitiveType: r.u8(sizes[3]) as EnumArray<PrimitiveType>,
            attributes: r.u8(sizes[3]) as EnumArray<OptionalVertexAttribute>,
            numPointFactors: r.u8(sizes[3]),
            numIndices: r.u32(sizes[3]),
            numVertices: r.u32(sizes[3]),
            numTextureBytes: r.u32(sizes[3]),
        } as SubMeshProjection,
        subMesh: {
            length: sizes[4],
            childIndex: r.u8(sizes[4]),
            objectId: r.u32(sizes[4]),
            materialIndex: r.u8(sizes[4]),
            primitiveType: r.u8(sizes[4]) as EnumArray<PrimitiveType>,
            materialType: r.u8(sizes[4]) as EnumArray<MaterialType>,
            attributes: r.u8(sizes[4]) as EnumArray<OptionalVertexAttribute>,
            numDeviations: r.u8(sizes[4]),
            vertices: { start: r.u32(sizes[4]), count: r.u32(sizes[4]) } as VertexRange,
            primitiveVertexIndices: { start: r.u32(sizes[4]), count: r.u32(sizes[4]) } as VertexIndexRange,
            edgeVertexIndices: { start: r.u32(sizes[4]), count: r.u32(sizes[4]) } as VertexIndexRange,
            cornerVertexIndices: { start: r.u32(sizes[4]), count: r.u32(sizes[4]) } as VertexIndexRange,
            textures: { start: r.u8(sizes[4]), count: r.u8(sizes[4]) } as TextureInfoRange,
            pointSizeExp: !flags[0] ? undefined : r.i8(sizes[4]),
        } as SubMesh,
        positionBPC: r.u8(sizes[5]),
        textureInfo: {
            length: sizes[6],
            semantic: r.u8(sizes[6]) as EnumArray<TextureSemantic>,
            transform: {
                length: sizes[6],
                e00: r.f32(sizes[6]),
                e01: r.f32(sizes[6]),
                e02: r.f32(sizes[6]),
                e10: r.f32(sizes[6]),
                e11: r.f32(sizes[6]),
                e12: r.f32(sizes[6]),
                e20: r.f32(sizes[6]),
                e21: r.f32(sizes[6]),
                e22: r.f32(sizes[6]),
            } as Float3x3,
            pixelRange: { start: r.u32(sizes[6]), count: r.u32(sizes[6]) } as PixelRange,
        } as TextureInfo,
        vertex: {
            length: sizes[7],
            position16: !flags[1] ? undefined : {
                length: sizes[7],
                x: r.i16(sizes[7]),
                y: r.i16(sizes[7]),
                z: r.i16(sizes[7]),
            } as Int16_3,
            position32: !flags[2] ? undefined : {
                length: sizes[7],
                x: r.i32(sizes[7]),
                y: r.i32(sizes[7]),
                z: r.i32(sizes[7]),
            } as Int32_3,
            normal: !flags[3] ? undefined : {
                length: sizes[7],
                x: r.i8(sizes[7]),
                y: r.i8(sizes[7]),
                z: r.i8(sizes[7]),
            } as Int8_3,
            color: !flags[4] ? undefined : {
                length: sizes[7],
                red: r.u8(sizes[7]),
                green: r.u8(sizes[7]),
                blue: r.u8(sizes[7]),
                alpha: r.u8(sizes[7]),
            } as RGBA_U8,
            texCoord: !flags[5] ? undefined : {
                length: sizes[7],
                x: r.f16(sizes[7]),
                y: r.f16(sizes[7]),
            } as Half2,
            projectedPos16: !flags[6] ? undefined : {
                length: sizes[7],
                x: r.i16(sizes[7]),
                y: r.i16(sizes[7]),
                z: r.i16(sizes[7]),
            } as Int16_3,
            projectedPos32: !flags[7] ? undefined : {
                length: sizes[7],
                x: r.i32(sizes[7]),
                y: r.i32(sizes[7]),
                z: r.i32(sizes[7]),
            } as Int32_3,
            pointIntensity: !flags[8] ? undefined : r.f16(sizes[7]),
            pointClassification: !flags[9] ? undefined : r.f16(sizes[7]),
            pointDeviation0: !flags[10] ? undefined : r.f16(sizes[7]),
            pointDeviation1: !flags[11] ? undefined : r.f16(sizes[7]),
            pointDeviation2: !flags[12] ? undefined : r.f16(sizes[7]),
            pointDeviation3: !flags[13] ? undefined : r.f16(sizes[7]),
            pointDeviation4: !flags[14] ? undefined : r.f16(sizes[7]),
            pointDeviation5: !flags[15] ? undefined : r.f16(sizes[7]),
        } as Vertex,
        triangle: {
            length: sizes[8],
            topologyFlags: !flags[16] ? undefined : r.u8(sizes[8]),
        } as Triangle,
        vertexIndex: !flags[17] ? undefined : r.u16(sizes[9]),
        texturePixels: r.u8(sizes[10]),
    } as const;
    console.assert(r.eof);
    return schema;
}

export type Schema = ReturnType<typeof readSchema>;
