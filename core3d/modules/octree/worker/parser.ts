import { type ReadonlyVec3, vec3 } from "gl-matrix";
import type { AABB, BoundingSphere } from "core3d/state";
import { BufferReader, Float16Array } from "./util";
import type { ComponentType, ShaderAttributeType, TextureParams } from "webgl2";
import { parseKTX } from "core3d/ktx";
import type { Mutex } from "../mutex";
import * as LTS from "./2_1";
import * as Current from "./2_3";
import * as Previous from "./2_2";
import type { WasmInstance } from "./wasm_loader";

const { MaterialType, OptionalVertexAttribute, PrimitiveType, TextureSemantic } = Current;
type Current = typeof Current;
type Previous = typeof Previous;
// extract common types and ensure that current and previous binary format versions of them are 100% overlapping
type Float3 = Current.Float3 | Previous.Float3 | LTS.Float3;
type Double3 = Current.Double3 | Previous.Double3 | LTS.Float3;
type Schema = Current.Schema | Previous.Schema | LTS.Schema;
type SubMeshProjection = Current.SubMeshProjection | Previous.SubMeshProjection | LTS.SubMeshProjection;
type MaterialType = Current.MaterialType | Previous.MaterialType | LTS.MaterialType;
type TextureSemantic = Current.TextureSemantic | Previous.TextureSemantic | LTS.TextureSemantic;
type PrimitiveType = Current.PrimitiveType | Previous.PrimitiveType | LTS.PrimitiveType;
type OptionalVertexAttribute = Current.OptionalVertexAttribute | Previous.OptionalVertexAttribute | LTS.OptionalVertexAttribute;

function isCurrentSchema(schema: Schema): schema is Current.Schema {
    return schema.version == Current.version;
}

export function isSupportedVersion(version: string) {
    return version == Current.version || version == Previous.version || version == LTS.version;
}

/** @internal */
export interface MeshDrawRange {
    readonly childIndex: number;
    readonly byteOffset: number; // in bytes
    readonly first: number; // # indices
    readonly count: number; // # indices
}

/** @internal */
export interface MeshObjectRange {
    readonly objectId: number;
    readonly beginVertex: number;
    readonly endVertex: number;
    readonly beginTriangle: number;
    readonly endTriangle: number;
}

/** @internal */
export interface Highlights {
    readonly indices: Uint8Array;
    readonly mutex: Mutex;
}

const primitiveTypeStrings = ["POINTS", "LINES", "LINE_LOOP", "LINE_STRIP", "TRIANGLES", "TRIANGLE_STRIP", "TRIANGLE_FAN"] as const;
/** @internal */
export type PrimitiveTypeString = typeof primitiveTypeStrings[number];

/** @internal */
export interface NodeBounds {
    readonly box: AABB;
    readonly sphere: BoundingSphere;
};

// node data contains everything needed to create a new node, except its geometry and textures
// this data comes from the parent node and is used to determine visibility and whether to load node geometry or not
/** @internal */
export interface NodeData {
    readonly id: string;
    readonly childIndex: number; // octant # (not mask, but index)
    readonly childMask: number; // 32-bit mask for what child indices (octants) have geometry
    readonly descendantObjectIds?: readonly number[]; // optional array of all object ids found in descendant nodes for filter optimization
    readonly tolerance: number;
    readonly byteSize: number; // uncompressed byte size of node file
    readonly offset: ReadonlyVec3;
    readonly scale: number;
    readonly bounds: NodeBounds;
    // readonly primitiveType: PrimitiveTypeString;
    // Used to predict the cost of creating geometry, potentially with filtering. Note that this does not consider the cost of loading, which ideally is a streaming process with low memory footprint
    readonly primitives: number;
    readonly primitivesDelta: number; // # new primitives introduced compared to parent
    readonly gpuBytes: number;
    //readonly posBPC: 16 | 32;
}

/** @internal */
export interface VertexAttributeData {
    readonly kind: ShaderAttributeType;
    readonly componentType: ComponentType;
    readonly buffer: number; // index into buffer array
    readonly componentCount: 1 | 2 | 3 | 4;
    readonly normalized: boolean;
    readonly byteStride: number;
    readonly byteOffset?: number;
};

/** @internal */
export interface VertexAttributes {
    readonly position: VertexAttributeData;
    readonly normal: VertexAttributeData | null;
    readonly material: VertexAttributeData | null;
    readonly objectId: VertexAttributeData | null;
    readonly texCoord: VertexAttributeData | null;
    readonly color: VertexAttributeData | null;
    readonly projectedPos: VertexAttributeData | null;
    readonly pointFactors0: VertexAttributeData | null;
    readonly pointFactors1: VertexAttributeData | null;
    readonly highlight: VertexAttributeData | null;
}

/** @internal */
export const enum VertexAttribIndex {
    triangles, position, normal, material, objectId, texCoord, color, projectedPos, deviations, highlight, highlightTri
};

/** @internal */
export interface NodeSubMesh {
    readonly materialType: MaterialType;
    readonly primitiveType: PrimitiveTypeString;
    readonly vertexAttributes: VertexAttributes;
    readonly numVertices: number;
    readonly numTriangles: number;
    readonly objectRanges: readonly MeshObjectRange[];
    // either index range (if index buffer is defined) for use with drawElements(), or vertex range for use with drawArray()
    readonly drawRanges: readonly MeshDrawRange[];
    readonly vertexBuffers: readonly ArrayBuffer[];
    readonly indices: Uint16Array | Uint32Array | number; // Index buffer, or # vertices of none
    readonly baseColorTexture: number | undefined; // texture index
}

/** @internal */
export interface NodeTexture {
    readonly semantic: TextureSemantic;
    readonly transform: readonly number[]; // 3x3 matrix
    readonly params: TextureParams;
}

// node geometry and textures
/** @internal */
export interface NodeGeometry {
    readonly subMeshes: readonly NodeSubMesh[];
    readonly textures: readonly (NodeTexture | undefined)[];
    readonly positionBPC: 16 | 32;
}

function getVec3(v: Float3 | Double3, i: number) {
    return vec3.fromValues(v.x[i], v.y[i], v.z[i]);
}

type Range = readonly [begin: number, end: number];
type FactorCount = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function getRange(v: { readonly start: ArrayLike<number>, count: ArrayLike<number>; }, i: number): Range {
    const begin = v.start[i];
    const end = begin + v.count[i];
    return [begin, end] as const;
}

function computePrimitiveCount(primitiveType: PrimitiveType, numIndices: number) {
    switch (primitiveType) {
        case PrimitiveType.points:
            return numIndices;
        case PrimitiveType.lines:
            return numIndices / 2;
        case PrimitiveType.lineLoop:
            return numIndices;
        case PrimitiveType.lineStrip:
            return numIndices - 1;
        case PrimitiveType.triangles:
            return numIndices / 3;
        case PrimitiveType.triangleStrip:
            return numIndices - 2;
        case PrimitiveType.triangleFan:
            return numIndices - 2;
        default:
            console.warn(`Unknown primitive type: ${primitiveType}!`);
    }
}

function getVertexAttribs(posBPC: 16 | 32, factorCount: number) {
    const posType = posBPC == 16 ? Uint16Array : Uint32Array;
    return {
        position: { type: posType, components: ["x", "y", "z"] },
        normal: { type: Int8Array, components: ["x", "y", "z"] },
        texCoord: { type: Float16Array, components: ["x", "y"] },
        color: { type: Uint8Array, components: ["red", "green", "blue", "alpha"] },
        projectedPos: { type: posType, components: ["x", "y", "z"] },
        pointFactors0: { type: Float16Array, components: ["a", "b", "c", "d"].slice(0, Math.min(factorCount, 4)) },
        pointFactors1: { type: Float16Array, components: ["a", "b", "c", "d"].slice(0, Math.max(0, factorCount - 4)) },
        materialIndex: { type: Uint8Array },
        objectId: { type: Uint32Array },
    } as const;
}
type VertexAttribs = ReturnType<typeof getVertexAttribs>;
type VertexAttribNames = keyof VertexAttribs;
type VertexAttrib = { readonly type: VertexAttribs[VertexAttribNames]["type"], readonly components?: readonly string[]; };

function computeVertexOffsets(attribs: readonly VertexAttribNames[], posBPC: 16 | 32, factorCount = 0) {
    let offset = 0;
    let offsets: any = {};
    function alignOffset(alignment: number) {
        const padding = alignment - 1 - (offset + alignment - 1) % alignment;
        offset += padding; // pad offset to be memory aligned.
    }
    let maxAlign = 1;
    const vertexAttribs = getVertexAttribs(posBPC, factorCount);
    for (const attrib of attribs) {
        const { type, components } = vertexAttribs[attrib] as VertexAttrib;
        const count = components?.length ?? 1;
        maxAlign = Math.max(maxAlign, type.BYTES_PER_ELEMENT);
        alignOffset(type.BYTES_PER_ELEMENT);
        offsets[attrib] = offset;
        offset += type.BYTES_PER_ELEMENT * count;
    }
    alignOffset(maxAlign); // align stride to largest typed array
    offsets.stride = offset;
    return offsets as { readonly [P in VertexAttribNames]?: number; } & { readonly stride: number; };
}

function getVertexAttribNames(optionalAttributes: OptionalVertexAttribute, factorCount: FactorCount, hasMaterials: boolean, hasObjectIds: boolean) {
    const attribNames: VertexAttribNames[] = ["position"];
    if (optionalAttributes & OptionalVertexAttribute.normal) attribNames.push("normal");
    if (optionalAttributes & OptionalVertexAttribute.texCoord) attribNames.push("texCoord");
    if (optionalAttributes & OptionalVertexAttribute.color) attribNames.push("color");
    if (optionalAttributes & OptionalVertexAttribute.projectedPos) attribNames.push("projectedPos");
    if (factorCount > 0) attribNames.push("pointFactors0");
    if (factorCount > 4) attribNames.push("pointFactors1");
    if (hasMaterials) {
        attribNames.push("materialIndex");
    }
    if (hasObjectIds) {
        attribNames.push("objectId");
    }
    return attribNames;
}

/** @internal */
export function aggregateSubMeshProjections(schema: Schema, range: Range, separatePositionBuffer: boolean, posBPC: 16 | 32, predicate?: (objectId: number) => boolean) {
    let primitives = 0;
    let totalTextureBytes = 0;
    let totalNumIndices = 0;
    let totalNumVertices = 0;
    let totalNumVertexBytes = 0;
    const { subMeshProjection } = schema;

    const [begin, end] = range;
    for (let i = begin; i < end; i++) {
        const objectId = subMeshProjection.objectId[i];
        if (predicate?.(objectId) ?? true) {
            const indices = subMeshProjection.numIndices[i];
            const vertices = subMeshProjection.numVertices[i];
            const textureBytes = subMeshProjection.numTextureBytes[i]; // TODO: adjust by device profile/resolution
            const attributes = subMeshProjection.attributes[i];
            const pointFactors = (isCurrentSchema(schema) ?
                schema.subMeshProjection.numPointFactors[i] :
                schema.subMeshProjection.numDeviations[i]) as FactorCount;

            const primitiveType = subMeshProjection.primitiveType[i];
            // we assume that textured nodes are terrain with no material index (but object_id?).
            // TODO: state these values explicitly in binary format instead
            const hasMaterials = textureBytes == 0;
            const hasObjectIds = true;
            const [pos, ...rest] = getVertexAttribNames(attributes, pointFactors, hasMaterials, hasObjectIds);
            const numBytesPerVertex = separatePositionBuffer ?
                computeVertexOffsets([pos], posBPC).stride + computeVertexOffsets(rest, posBPC, pointFactors).stride :
                computeVertexOffsets([pos, ...rest], posBPC, pointFactors).stride;
            primitives += computePrimitiveCount(primitiveType, indices ? indices : vertices) ?? 0;
            totalNumIndices += indices;
            totalNumVertices += vertices;
            totalNumVertexBytes += vertices * numBytesPerVertex;
            totalTextureBytes += textureBytes;
        } else {
            // debugger;
        }
    }
    const idxStride = totalNumVertices < 0xffff ? 2 : 4;
    const gpuBytes = totalTextureBytes + totalNumVertexBytes + totalNumIndices * idxStride;
    return { primitives, gpuBytes } as const;
}

function toHex(bytes: Uint8Array) {
    return Array.prototype.map.call(bytes, x => ('00' + x.toString(16).toUpperCase()).slice(-2)).join('');
}

/** @internal */
export function getChildren(parentId: string, schema: Schema, separatePositionBuffer: boolean, predicate?: (objectId: number) => boolean): NodeData[] {
    const { childInfo, hashBytes } = schema;
    const children: NodeData[] = [];


    // compute parent/current mesh primitive counts per child partition
    const parentPrimitiveCounts: number[] = [];

    for (let i = 0; i < childInfo.length; i++) {
        const childIndex = childInfo.childIndex[i];
        const childMask = childInfo.childMask[i];
        const [hashBegin, hashEnd] = getRange(childInfo.hash, i);
        const hash = hashBytes.slice(hashBegin, hashEnd);
        const id = toHex(hash); // parentId + childIndex.toString(32); // use radix 32 (0-9, a-v) encoding, which allows for max 32 children per node
        const tolerance = childInfo.tolerance[i];
        const byteSize = childInfo.totalByteSize[i];
        // vertex position bits per channel (16/32)
        const posBPC = "positionBPC" in childInfo ? childInfo.positionBPC[i] as 16 | 32 : 16;
        const offset = getVec3(childInfo.offset, i);
        const scale = childInfo.scale[i];
        const bounds: NodeBounds = {
            box: {
                min: getVec3(childInfo.bounds.box.min, i),
                max: getVec3(childInfo.bounds.box.max, i),
            },
            sphere: {
                center: getVec3(childInfo.bounds.sphere.origo, i),
                radius: childInfo.bounds.sphere.radius[i],
            }
        };
        // offset bounds
        const { sphere, box } = bounds;
        vec3.add(sphere.center as vec3, sphere.center, offset);
        vec3.add(box.min as vec3, box.min, offset);
        vec3.add(box.max as vec3, box.max, offset);

        const subMeshProjectionRange = getRange(childInfo.subMeshes, i);
        const parentPrimitives = parentPrimitiveCounts[childIndex];
        const { primitives, gpuBytes } = aggregateSubMeshProjections(schema, subMeshProjectionRange, separatePositionBuffer, posBPC, predicate);
        const primitivesDelta = primitives - (parentPrimitives ?? 0);
        let descendantObjectIds: number[] | undefined;
        if (schema.childInfo.descendantObjectIds) {
            const [idsBegin, idsEnd] = getRange(schema.childInfo.descendantObjectIds, i);
            if (idsBegin != idsEnd) {
                descendantObjectIds = [...schema.descendantObjectIds.slice(idsBegin, idsEnd)];
            }
        }
        // console.assert(parentId == "0" || primitivesDelta >= 0, "negative primitive delta");
        children.push({ id, childIndex, childMask, tolerance, byteSize, offset, scale, bounds, primitives, primitivesDelta, gpuBytes, descendantObjectIds });
    }
    return children;
}

/** @internal */
export function* getSubMeshes(schema: Schema, predicate?: (objectId: number) => boolean) {
    const { subMesh } = schema;
    for (let i = 0; i < subMesh.length; i++) {
        const objectId = subMesh.objectId[i];
        const primitive = subMesh.primitiveType[i];
        if (predicate?.(objectId) ?? true) {
            const childIndex = subMesh.childIndex[i];
            const objectId = subMesh.objectId[i];
            const materialIndex = subMesh.materialIndex[i];
            const materialType = materialIndex ==
                0xff && subMesh.textures.count[i] == 0 && (primitive == PrimitiveType.triangleStrip || primitive == PrimitiveType.triangles) ?
                MaterialType.elevation :
                subMesh.materialType[i];
            const primitiveType = subMesh.primitiveType[i];
            const attributes = subMesh.attributes[i];
            const pointFactors = (isCurrentSchema(schema) ? schema.subMesh.numPointFactors[i] : schema.subMesh.numDeviations[i]) as FactorCount;
            const vertexRange = getRange(subMesh.vertices, i);
            const indexRange = getRange(subMesh.primitiveVertexIndices, i);
            const textureRange = getRange(subMesh.textures, i);
            yield { childIndex, objectId, materialIndex, materialType, primitiveType, attributes, pointFactors, vertexRange, indexRange, textureRange };
        }
    }
}
type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;

// Candidates for wasm implementation?
function copyToInterleavedArray<T extends TypedArray>(wasm: WasmInstance, dst: T, src: T, byteOffset: number, byteStride: number, begin: number, end: number) {
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

function fillToInterleavedArray<T extends TypedArray>(wasm: WasmInstance, dst: T, src: number, byteOffset: number, byteStride: number, begin: number, end: number) {
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

function getGeometry(wasm: WasmInstance, schema: Schema, separatePositionBuffer: boolean, enableOutlines: boolean, highlights: Highlights, predicate?: (objectId: number) => boolean): NodeGeometry {
    const { vertex, vertexIndex } = schema;

    const filteredSubMeshes = [...getSubMeshes(schema, predicate)];

    let subMeshes: NodeSubMesh[] = [];
    const referencedTextures = new Set<number>();

    // group submeshes into drawable meshes (with common attributes)
    type Group = {
        readonly materialType: number;
        readonly primitiveType: number;
        readonly attributes: number;
        readonly pointFactors: FactorCount;
        readonly subMeshIndices: number[];
    };
    const groups = new Map<string, Group>();
    for (let i = 0; i < filteredSubMeshes.length; i++) {
        const { materialType, primitiveType, attributes, pointFactors, childIndex } = filteredSubMeshes[i];
        const key = `${materialType}_${primitiveType}_${attributes}_${pointFactors}_${childIndex}`;
        let group = groups.get(key);
        if (!group) {
            group = { materialType, primitiveType, attributes, pointFactors, subMeshIndices: [] };
            groups.set(key, group);
        }
        group.subMeshIndices.push(i);
    }

    // vertex position bits per channel (16/32)
    const posBPC = "positionBPC" in schema ? schema.positionBPC[0] as 16 | 32 : 16;

    // we don't want highlights to change during parsing, so we hold the lock for the entire file
    highlights.mutex.lockSync();

    // create drawable meshes
    for (const { materialType, primitiveType, attributes, pointFactors, subMeshIndices } of groups.values()) {
        if (subMeshIndices.length == 0)
            continue;
        const groupMeshes = subMeshIndices.map(i => filteredSubMeshes[i]);
        const hasMaterials = groupMeshes.some(m => m.materialIndex != 0xff);
        const hasObjectIds = groupMeshes.some(m => m.objectId != 0xffffffff);

        const allAttribNames = getVertexAttribNames(attributes, pointFactors, hasMaterials, hasObjectIds);
        const [posName, ...extraAttribNames] = allAttribNames; // pop off positions since we're potentially putting them in a separate buffer
        const attribNames = separatePositionBuffer ? extraAttribNames : allAttribNames;
        const positionStride = computeVertexOffsets([posName], posBPC, pointFactors).stride;
        const attribOffsets = computeVertexOffsets(attribNames, posBPC, pointFactors);
        const vertexStride = attribOffsets.stride;

        const childIndices = [...new Set<number>(groupMeshes.map(sm => sm.childIndex))].sort();
        let numVertices = 0;
        let numIndices = 0;
        let numTriangles = 0;
        for (let i = 0; i < groupMeshes.length; i++) {
            const sm = groupMeshes[i];
            const vtxCnt = sm.vertexRange[1] - sm.vertexRange[0];
            const idxCnt = sm.indexRange[1] - sm.indexRange[0];
            numVertices += vtxCnt;
            numIndices += idxCnt;
            if (primitiveType == PrimitiveType.triangles) {
                numTriangles += Math.round((idxCnt > 0 ? idxCnt : vtxCnt) / 3);
            }
        }
        const vertexBuffer = new ArrayBuffer(numVertices * vertexStride);
        const positionBuffer = separatePositionBuffer ? new ArrayBuffer(numVertices * positionStride) : undefined;
        let indexBuffer: Uint32Array | Uint16Array | undefined;
        if (vertexIndex) {
            indexBuffer = new (numVertices < 0xffff ? Uint16Array : Uint32Array)(numIndices);
        }
        const highlightBuffer = new Uint8Array(numVertices);
        let indexOffset = 0;
        let vertexOffset = 0;
        let triangleOffset = 0;
        let drawRanges: MeshDrawRange[] = [];
        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const objectRanges: Mutable<MeshObjectRange>[] = [];

        function enumerateBuffers<K extends string>(possibleBuffers: { readonly [P in K]: ArrayBuffer | undefined }) {
            const buffers: ArrayBuffer[] = [];
            const indices = {} as { readonly [P in K]: number };
            for (const [key, value] of Object.entries(possibleBuffers)) {
                const buffer = value as ArrayBuffer | undefined;
                let index = -1;
                if (buffer) {
                    index = buffers.indexOf(buffer);
                    if (index < 0) {
                        index = buffers.length;
                        buffers.push(buffer);
                    }
                }
                Reflect.set(indices, key, index);
            }
            return [buffers, indices] as const;
        }

        const [vertexBuffers, bufIdx] = enumerateBuffers({
            primary: vertexBuffer,
            highlight: highlightBuffer?.buffer,
            pos: positionBuffer
        });

        for (const childIndex of childIndices) {
            const meshes = groupMeshes.filter(sm => sm.childIndex == childIndex);
            if (meshes.length == 0)
                continue;

            const drawRangeBegin = indexBuffer ? indexOffset : vertexOffset;

            for (const subMesh of meshes) {
                const { vertexRange, indexRange, materialIndex, pointFactors, objectId } = subMesh;
                const context = { materialIndex, objectId };
                const [beginVtx, endVtx] = vertexRange;
                const [beginIdx, endIdx] = indexRange;

                // initialize vertex buffer
                const vertexAttribs = getVertexAttribs(posBPC, pointFactors);
                for (const attribName of attribNames) {
                    const { type, components } = vertexAttribs[attribName] as VertexAttrib;
                    const dst = new type(vertexBuffer, vertexOffset * vertexStride);
                    const count = components?.length ?? 1;
                    for (var c = 0; c < count; c++) {
                        const offs = attribOffsets[attribName]! + c * type.BYTES_PER_ELEMENT;
                        if (attribName in vertex) {
                            let src = Reflect.get(vertex, attribName) as typeof dst;
                            if (components) {
                                src = Reflect.get(src, components[c]);
                            }
                            copyToInterleavedArray(wasm, dst, src, offs, vertexStride, beginVtx, endVtx);
                        } else {
                            const src = Reflect.get(context, attribName) as number;
                            fillToInterleavedArray(wasm, dst, src, offs, vertexStride, beginVtx, endVtx);
                        }
                    }
                }

                // initialize triangle vertex buffer for clipping intersection
                const numTrianglesInSubMesh = vertexIndex && indexBuffer ? (endIdx - beginIdx) / 3 : (endVtx - beginVtx) / 3;

                if (positionBuffer) {
                    const srcPosBuf = "position" in vertex ? vertex.position : vertex[posBPC == 16 ? "position16" : "position32"]!;
                    // initialize separate positions buffer
                    if (posBPC == 16) {
                        const i16 = new Int16Array(positionBuffer, vertexOffset * positionStride);
                        copyToInterleavedArray(wasm, i16, srcPosBuf.x, 0, positionStride, beginVtx, endVtx);
                        copyToInterleavedArray(wasm, i16, srcPosBuf.y, 2, positionStride, beginVtx, endVtx);
                        copyToInterleavedArray(wasm, i16, srcPosBuf.z, 4, positionStride, beginVtx, endVtx);
                    } else {
                        const i32 = new Int32Array(positionBuffer, vertexOffset * positionStride);
                        copyToInterleavedArray(wasm, i32, srcPosBuf.x, 0, positionStride, beginVtx, endVtx);
                        copyToInterleavedArray(wasm, i32, srcPosBuf.y, 4, positionStride, beginVtx, endVtx);
                        copyToInterleavedArray(wasm, i32, srcPosBuf.z, 8, positionStride, beginVtx, endVtx);
                    }
                }

                // initialize index buffer (if any)
                if (vertexIndex && indexBuffer) {
                    for (let i = beginIdx; i < endIdx; i++) {
                        indexBuffer[indexOffset++] = vertexIndex[i] + vertexOffset;
                    }
                }

                const endVertex = vertexOffset + (endVtx - beginVtx);
                const endTriangle = triangleOffset + (endIdx - beginIdx) / 3;
                // initialize highlight buffer
                const highlightIndex = highlights.indices[objectId] ?? 0;
                if (highlightIndex) {
                    highlightBuffer.fill(highlightIndex, vertexOffset, endVertex);
                }

                // update object ranges
                const prev = objectRanges.length - 1;
                if (prev >= 0 && objectRanges[prev].objectId == objectId) {
                    // merge with previous entry
                    objectRanges[prev].endVertex = endVertex;
                    objectRanges[prev].endTriangle = endTriangle;
                } else {
                    objectRanges.push({ objectId, beginVertex: vertexOffset, endVertex, beginTriangle: triangleOffset, endTriangle });
                }
                triangleOffset += numTrianglesInSubMesh;
                vertexOffset += endVtx - beginVtx;
            }

            const drawRangeEnd = indexBuffer ? indexOffset : vertexOffset;
            const byteOffset = drawRangeBegin * (indexBuffer ? indexBuffer.BYTES_PER_ELEMENT : vertexStride);
            const count = drawRangeEnd - drawRangeBegin;
            drawRanges.push({ childIndex, byteOffset, first: drawRangeBegin, count });
        }

        console.assert(vertexOffset == numVertices);
        console.assert(indexOffset == numIndices);
        const indices = indexBuffer ?? numVertices;

        const [beginTexture, endTexture] = groupMeshes[0].textureRange;
        let baseColorTexture: number | undefined;
        if (endTexture > beginTexture) {
            baseColorTexture = beginTexture;
        }

        if (baseColorTexture != undefined) {
            referencedTextures.add(baseColorTexture);
        }

        const stride = vertexStride;
        const pointFactors0Components = Math.min(4, pointFactors) as 1 | 2 | 3 | 4;
        const pointFactors1Components = pointFactors - 4 as 1 | 2 | 3 | 4;
        const pointFactors0Kind = pointFactors == 1 ? "FLOAT" as const : `FLOAT_VEC${pointFactors0Components as 2 | 3 | 4}` as const;
        const pointFactors1Kind = pointFactors == 5 ? "FLOAT" as const : `FLOAT_VEC${pointFactors1Components as 2 | 3 | 4}` as const;

        const posCT = posBPC == 16 ? "SHORT" : "INT";
        const vertexAttributes = {
            position: { kind: "FLOAT_VEC4", buffer: bufIdx.pos, componentCount: 3, componentType: posCT, normalized: true, byteOffset: attribOffsets["position"], byteStride: separatePositionBuffer ? 0 : stride },
            normal: (attributes & OptionalVertexAttribute.normal) != 0 ? { kind: "FLOAT_VEC3", buffer: bufIdx.primary, componentCount: 3, componentType: "BYTE", normalized: true, byteOffset: attribOffsets["normal"], byteStride: stride } : null,
            material: hasMaterials ? { kind: "UNSIGNED_INT", buffer: bufIdx.primary, componentCount: 1, componentType: "UNSIGNED_BYTE", normalized: false, byteOffset: attribOffsets["materialIndex"], byteStride: stride } : null,
            objectId: hasObjectIds ? { kind: "UNSIGNED_INT", buffer: bufIdx.primary, componentCount: 1, componentType: "UNSIGNED_INT", normalized: false, byteOffset: attribOffsets["objectId"], byteStride: stride } : null,
            texCoord: (attributes & OptionalVertexAttribute.texCoord) != 0 ? { kind: "FLOAT_VEC2", buffer: bufIdx.primary, componentCount: 2, componentType: "HALF_FLOAT", normalized: false, byteOffset: attribOffsets["texCoord"], byteStride: stride } : null,
            color: (attributes & OptionalVertexAttribute.color) != 0 ? { kind: "FLOAT_VEC4", buffer: bufIdx.primary, componentCount: 4, componentType: "UNSIGNED_BYTE", normalized: true, byteOffset: attribOffsets["color"], byteStride: stride } : null,
            projectedPos: (attributes & OptionalVertexAttribute.projectedPos) != 0 ? { kind: "FLOAT_VEC4", buffer: bufIdx.primary, componentCount: 3, componentType: posCT, normalized: true, byteOffset: attribOffsets["projectedPos"], byteStride: stride } : null,
            pointFactors0: pointFactors0Components >= 1 ? { kind: pointFactors0Kind, buffer: bufIdx.primary, componentCount: pointFactors0Components, componentType: "HALF_FLOAT", normalized: false, byteOffset: attribOffsets["pointFactors0"], byteStride: stride } : null,
            pointFactors1: pointFactors1Components >= 1 ? { kind: pointFactors1Kind, buffer: bufIdx.primary, componentCount: pointFactors1Components, componentType: "HALF_FLOAT", normalized: false, byteOffset: attribOffsets["pointFactors1"], byteStride: stride } : null,
            highlight: { kind: "UNSIGNED_INT", buffer: bufIdx.highlight, componentCount: 1, componentType: "UNSIGNED_BYTE", normalized: false, byteOffset: 0, byteStride: 0 },
        } as const satisfies VertexAttributes;

        objectRanges.sort((a, b) => (a.objectId - b.objectId));

        subMeshes.push({
            materialType,
            primitiveType: primitiveTypeStrings[primitiveType],
            numVertices,
            numTriangles,
            objectRanges,
            vertexAttributes,
            vertexBuffers,
            indices,
            baseColorTexture,
            drawRanges
        });
    }

    highlights.mutex.unlock();

    const textures = new Array<NodeTexture | undefined>(schema.textureInfo.length);
    const { textureInfo } = schema;
    for (const i of referencedTextures) {
        const [begin, end] = getRange(textureInfo.pixelRange, i);
        const semantic = textureInfo.semantic[i];
        const transform = [
            textureInfo.transform.e00[i],
            textureInfo.transform.e01[i],
            textureInfo.transform.e02[i],
            textureInfo.transform.e10[i],
            textureInfo.transform.e11[i],
            textureInfo.transform.e12[i],
            textureInfo.transform.e20[i],
            textureInfo.transform.e21[i],
            textureInfo.transform.e22[i],
        ] as const;
        const ktx = schema.texturePixels.subarray(begin, end);
        const params = parseKTX(ktx);
        textures[i] = { semantic, transform, params };
    }


    return { subMeshes, textures, positionBPC: posBPC } as const satisfies NodeGeometry;
}

export function parseNode(wasm: WasmInstance, id: string, separatePositionBuffer: boolean, enableOutlines: boolean, version: string, buffer: ArrayBuffer, highlights: Highlights, applyFilter: boolean) {
    console.assert(isSupportedVersion(version));
    const r = new BufferReader(buffer);
    var schema = version == Current.version ? Current.readSchema(r) : version == Previous.version ? Previous.readSchema(r) : LTS.readSchema(r);
    let predicate: ((objectId: number) => boolean) | undefined;
    predicate = applyFilter ? (objectId =>
        highlights.indices[objectId] != 0xff
    ) : undefined;
    const childInfos = getChildren(id, schema, separatePositionBuffer, predicate);
    const geometry = getGeometry(wasm, schema, separatePositionBuffer, enableOutlines, highlights, predicate);
    return { childInfos, geometry } as const;
}
