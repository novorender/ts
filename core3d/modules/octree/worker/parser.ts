import { type ReadonlyVec3, vec3 } from "gl-matrix";
import type { AABB, BoundingSphere } from "core3d/state";
import { BufferReader, Float16Array } from "./util";
import type { TextureParams } from "webgl2";
import { parseKTX } from "core3d/ktx";
import type { Mutex } from "../mutex";
import * as LTS from "./2_1";
import * as Current from "./2_3";
import * as Previous from "./2_2";
import type { WasmInstance } from "./wasm_loader";
import type { FillValues, ParseConfig, VertexAttributeSource } from ".";
import { initVertexBufferRange, layoutAttributes, vertexAttributeFloat, vertexAttributeInt, vertexAttributeUint, type VertexAttributes, vertexAttributeData } from "./attribs";

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


export interface PointFactors {
    readonly hasIntensity: boolean;
    readonly hasClassification: boolean;
    readonly numDeviations: number;
}

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

export const enum VertexBufferIndex {
    primary,
    highlight,
    pos
}


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
    readonly pointSize?: number; // Point meters
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

function getVertexAttributes(pointFactors: PointFactors, posBPC: 16 | 32, optionalAttributes: OptionalVertexAttribute, hasMaterials: boolean, hasObjectIds: boolean) {
    const factorsLength = pointFactors.numDeviations + (pointFactors.hasIntensity ? 1 : 0) + (pointFactors.hasClassification ? 1 : 0);

    const u8 = new Uint8Array;
    const i8 = new Int8Array;
    const u32 = new Uint32Array;
    const i16 = new Int16Array;
    const i32 = new Int32Array;
    const f16 = new Float16Array;

    const posType = posBPC == 16 ? i16 : i32;
    const factorsSrc = new Array<Float16Array>(factorsLength);
    factorsSrc.fill(f16, 0, factorsLength);
    const factorsSrc0 = factorsSrc.slice(0, 4);
    const factorSrc1 = factorsSrc.slice(4, 8);

    const vertexAttributesSrc = {
        position: vertexAttributeFloat([posType, posType, posType], VertexBufferIndex.pos),
        normal: (optionalAttributes & OptionalVertexAttribute.normal) != 0 ? vertexAttributeFloat([i8, i8, i8], VertexBufferIndex.primary) : null,
        material: hasMaterials ? vertexAttributeUint([u8], VertexBufferIndex.primary) : null,
        objectId: hasObjectIds ? vertexAttributeUint([u32], VertexBufferIndex.primary) : null,
        texCoord0: (optionalAttributes & OptionalVertexAttribute.texCoord) != 0 ? vertexAttributeFloat([f16, f16], VertexBufferIndex.primary, true) : null,
        color0: (optionalAttributes & OptionalVertexAttribute.color) != 0 ? vertexAttributeFloat([u8, u8, u8, u8], VertexBufferIndex.primary) : null,
        projectedPos: (optionalAttributes & OptionalVertexAttribute.projectedPos) != 0 ? vertexAttributeFloat([posType, posType, posType], VertexBufferIndex.primary) : null,
        pointFactors0: factorsSrc0.length > 0 ? vertexAttributeFloat(factorsSrc0, VertexBufferIndex.primary, true) : null,
        pointFactors1: factorSrc1.length > 0 ? vertexAttributeFloat(factorSrc1, VertexBufferIndex.primary, true) : null,
        highlight: vertexAttributeUint([new Uint8Array], VertexBufferIndex.highlight),
    } as const satisfies VertexAttributes<VertexAttributeSource>;
    return vertexAttributesSrc;
}

/** @internal */
export function aggregateSubMeshProjections(schema: Schema, range: Range, posBPC: 16 | 32, pointFactors: PointFactors, predicate?: (objectId: number) => boolean) {
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
            const primitiveType = subMeshProjection.primitiveType[i];
            // we assume that textured nodes are terrain with no material index (but object_id?).
            // TODO: state these values explicitly in binary format instead
            const hasMaterials = textureBytes == 0;
            const hasObjectIds = true;
            const vertexAttributesSrc = getVertexAttributes(pointFactors, posBPC, attributes, hasMaterials, hasObjectIds);
            const { attributes: vertexAttributes, byteStrides } = layoutAttributes(vertexAttributesSrc);

            const numBytesPerVertex = byteStrides.reduce((a, b) => a + b);

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
export function getChildren(schema: Schema, pointFactors: PointFactors, predicate?: (objectId: number) => boolean): NodeData[] {
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
        const { primitives, gpuBytes } = aggregateSubMeshProjections(schema, subMeshProjectionRange, posBPC, pointFactors, predicate);
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
            const numDeviations = schema.subMesh.numDeviations[i];
            const vertexRange = getRange(subMesh.vertices, i);
            const indexRange = getRange(subMesh.primitiveVertexIndices, i);
            const textureRange = getRange(subMesh.textures, i);
            const pointSize = isCurrentSchema(schema) && schema.subMesh.pointSizeExp ?
                Math.pow(2, schema.subMesh.pointSizeExp[i]) : undefined;
            yield { childIndex, objectId, materialIndex, materialType, primitiveType, attributes, numDeviations, vertexRange, indexRange, textureRange, pointSize };
        }
    }
}

function getGeometry(wasm: WasmInstance, schema: Schema, enableOutlines: boolean, highlights: Highlights, pointFactors: PointFactors, predicate?: (objectId: number) => boolean): NodeGeometry {
    const { vertex, vertexIndex } = schema;

    const filteredSubMeshes = [...getSubMeshes(schema, predicate)];

    let subMeshes: NodeSubMesh[] = [];
    const referencedTextures = new Set<number>();

    const pointFactorsCount = (pointFactors.numDeviations + (pointFactors.hasClassification ? 1 : 0) + (pointFactors.hasIntensity ? 1 : 0)) as FactorCount;

    // group submeshes into drawable meshes (with common attributes)
    type Group = {
        readonly materialType: number;
        readonly primitiveType: number;
        readonly attributes: number;
        readonly pointFactorsCount: FactorCount;
        readonly subMeshIndices: number[];
        readonly pointSize?: number;
    };
    const groups = new Map<string, Group>();
    for (let i = 0; i < filteredSubMeshes.length; i++) {
        const { materialType, primitiveType, attributes, numDeviations, childIndex, pointSize } = filteredSubMeshes[i];
        const key = `${materialType}_${primitiveType}_${attributes}_${numDeviations}_${childIndex}`;
        let group = groups.get(key);
        if (!group) {
            group = { materialType, primitiveType, attributes, pointFactorsCount, subMeshIndices: [], pointSize };
            groups.set(key, group);
        }
        group.subMeshIndices.push(i);
    }

    // vertex position bits per channel (16/32)
    const posBPC = "positionBPC" in schema ? schema.positionBPC[0] as 16 | 32 : 16;

    // we don't want highlights to change during parsing, so we hold the lock for the entire file
    highlights.mutex.lockSync();

    // create drawable meshes
    for (const { materialType, primitiveType, attributes, pointFactorsCount, subMeshIndices, pointSize } of groups.values()) {
        if (subMeshIndices.length == 0)
            continue;
        const groupMeshes = subMeshIndices.map(i => filteredSubMeshes[i]);
        const hasMaterials = groupMeshes.some(m => m.materialIndex != 0xff);
        const hasObjectIds = groupMeshes.some(m => m.objectId != 0xffffffff);
        const maxNumDeviations = groupMeshes.reduce((max, m) => Math.max(max, m.numDeviations), 0);

        const pos = "position" in vertex ? vertex.position : vertex[posBPC == 16 ? "position16" : "position32"]!;
        const projectedPos = (attributes & OptionalVertexAttribute.projectedPos) != 0 ?
            "position" in vertex ? vertex.projectedPos : vertex[posBPC == 16 ? "projectedPos16" : "projectedPos32"]!
            : undefined;
        const { normal, texCoord, color } = vertex;

        const factorSources: Float16Array[] = [];
        if (isCurrentSchema(schema)) {
            if (pointFactors.hasIntensity) {
                factorSources.push(schema.vertex.pointIntensity ?? new Float16Array)
            }
            if (pointFactors.hasClassification) {
                factorSources.push(schema.vertex.pointClassification ?? new Float16Array)
            }
            for (let i = 0; i < maxNumDeviations; ++i) {
                factorSources.push(schema.vertex[`pointDeviation${i as 0 | 1 | 2 | 3 | 4 | 5}`] ?? new Float16Array)
            }
        } else {
            const deviations = [schema.vertex.deviations.a, schema.vertex.deviations.b, schema.vertex.deviations.c, schema.vertex.deviations.d]
            for (let i = 0; i < maxNumDeviations; ++i) {
                const deviation = deviations[i];
                if (deviation) {
                    factorSources.push(deviation);
                } else {
                    factorSources.push(new Float16Array);
                }
            }
        }

        const factorsSrc0 = factorSources.slice(0, 4);
        const factorSrc1 = factorSources.slice(4, 8);

        const vertexAttributesSrc = getVertexAttributes({ ...pointFactors, numDeviations: maxNumDeviations }, posBPC, attributes, hasMaterials, hasObjectIds);
        vertexAttributesSrc.position.components = [pos.x, pos.y, pos.z];
        if (vertexAttributesSrc.normal != undefined && normal)
            vertexAttributesSrc.normal!.components = [normal.x, normal.y, normal.z];
        if (texCoord && vertexAttributesSrc.texCoord0)
            vertexAttributesSrc.texCoord0.components = [texCoord.x, texCoord.y];
        if (color)
            vertexAttributesSrc.color0!.components = [color.red, color.green, color.blue, color.alpha];
        if (projectedPos)
            vertexAttributesSrc.projectedPos!.components = [projectedPos.x, projectedPos.y, projectedPos.z];
        if (factorsSrc0.length > 0)
            vertexAttributesSrc.pointFactors0!.components = factorsSrc0;
        if (factorSrc1.length > 0)
            vertexAttributesSrc.pointFactors1!.components = factorSrc1;

        const { attributes: vertexAttributes, byteStrides } = layoutAttributes(vertexAttributesSrc);

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

        let indexBuffer: Uint32Array | Uint16Array | undefined;
        if (vertexIndex) {
            indexBuffer = new (numVertices < 0xffff ? Uint16Array : Uint32Array)(numIndices);
        }
        // const highlightBuffer = new Uint8Array(numVertices);
        let indexOffset = 0;
        let vertexOffset = 0;
        let triangleOffset = 0;
        let drawRanges: MeshDrawRange[] = [];
        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const objectRanges: Mutable<MeshObjectRange>[] = [];

        const vertexBuffers = byteStrides.map(bs => new ArrayBuffer(bs * numVertices));

        for (const childIndex of childIndices) {
            const meshes = groupMeshes.filter(sm => sm.childIndex == childIndex);
            if (meshes.length == 0)
                continue;

            const drawRangeBegin = indexBuffer ? indexOffset : vertexOffset;

            for (const subMesh of meshes) {
                const { vertexRange, indexRange, materialIndex, objectId } = subMesh;

                const fillValues: FillValues = { material: materialIndex, objectId, highlight: highlights.indices[objectId] ?? 0 };
                const [beginVtx, endVtx] = vertexRange;
                const [beginIdx, endIdx] = indexRange;

                initVertexBufferRange(vertexBuffers, beginVtx, endVtx, vertexOffset, fillValues, vertexAttributes);

                // initialize triangle vertex buffer for clipping intersection
                const numTrianglesInSubMesh = vertexIndex && indexBuffer ? (endIdx - beginIdx) / 3 : (endVtx - beginVtx) / 3;


                // initialize index buffer (if any)
                if (vertexIndex && indexBuffer) {
                    for (let i = beginIdx; i < endIdx; i++) {
                        indexBuffer[indexOffset++] = vertexIndex[i] + vertexOffset;
                    }
                }

                const endVertex = vertexOffset + (endVtx - beginVtx);
                const endTriangle = triangleOffset + (endIdx - beginIdx) / 3;

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
            const byteOffset = drawRangeBegin * (indexBuffer ? indexBuffer.BYTES_PER_ELEMENT : byteStrides[VertexBufferIndex.primary]);
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

        objectRanges.sort((a, b) => (a.objectId - b.objectId));
        subMeshes.push({
            materialType,
            primitiveType: primitiveTypeStrings[primitiveType],
            numVertices,
            numTriangles,
            objectRanges,
            vertexAttributes: vertexAttributeData(vertexAttributes),
            vertexBuffers,
            indices,
            baseColorTexture,
            drawRanges,
            pointSize
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

export function parseNode(wasm: WasmInstance, config: ParseConfig, enableOutlines: boolean, buffer: ArrayBuffer, highlights: Highlights, applyFilter: boolean) {
    const { version } = config;
    console.assert(isSupportedVersion(version));
    const pointFactors: PointFactors = { hasIntensity: config.hasPointIntensity ?? false, hasClassification: config.hasPointClassification ?? false, numDeviations: config.numPointDeviations ?? 0 };
    const r = new BufferReader(buffer);
    var schema = version == Current.version ? Current.readSchema(r) : version == Previous.version ? Previous.readSchema(r) : LTS.readSchema(r);
    let predicate: ((objectId: number) => boolean) | undefined;
    predicate = applyFilter ? (objectId =>
        highlights.indices[objectId] != 0xff
    ) : undefined;
    const childInfos = getChildren(schema, pointFactors, predicate);
    const geometry = getGeometry(wasm, schema, enableOutlines, highlights, pointFactors, predicate);
    return { childInfos, geometry } as const;
}
