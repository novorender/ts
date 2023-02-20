import { ReadonlyVec3, vec3 } from "gl-matrix";
import { AABB, BoundingSphere } from "@novorender/core3d/state";
import { Double3, Float3, MaterialType, OptionalVertexAttribute, PrimitiveType, readSchema, Schema, SubMeshProjection, TextureSemantic } from "./schema";
import { BufferReader, Float16Array } from "./util";
import type { ComponentType, ShaderAttributeType, TextureParams, TextureParams2DArrayUncompressed, TextureParams2DUncompressed } from "@novorender/webgl2";
import { KTX } from "@novorender/core3d/ktx";
// import { Public, Render } from "types";
// import { MeshDrawRange } from "../context";

export interface MeshDrawRange {
    readonly childIndex: number;
    readonly byteOffset: number; // in bytes
    readonly first: number; // # indices
    readonly count: number; // # indices
}

export interface MeshObjectRange {
    readonly objectId: number;
    readonly beginVertex: number;
    readonly endVertex: number;
}

const primitiveTypeStrings = ["POINTS", "LINES", "LINE_LOOP", "LINE_STRIP", "TRIANGLES", "TRIANGLE_STRIP", "TRIANGLE_FAN"] as const;
export type PrimitiveTypeString = typeof primitiveTypeStrings[number];


export interface Bounds {
    readonly box: AABB;
    readonly sphere: BoundingSphere;
};

// node data contains everything needed to create a new node, except its geometry and textures
// this data comes from the parent node and is used to determine visibility and whether to load node geometry or not
export interface NodeData {
    readonly id: string;
    readonly childIndex: number; // octant # (not mask, but index)
    readonly childMask: number; // 32-bit mask for what child indices (octants) have geometry
    readonly tolerance: number;
    readonly byteSize: number; // uncompressed byte size of node file
    readonly offset: ReadonlyVec3;
    readonly scale: number;
    readonly bounds: Bounds;
    // readonly primitiveType: PrimitiveTypeString;
    // Used to predict the cost of creating geometry, potentially with filtering. Note that this does not consider the cost of loading, which ideally is a streaming process with low memory footprint
    readonly primitives: number;
    readonly primitivesDelta: number; // # new primitives introduced compared to parent
    readonly gpuBytes: number;
}

export interface VertexAttributeData {
    readonly kind: ShaderAttributeType;
    readonly componentType: ComponentType;
    readonly buffer: number; // index into buffer array
    readonly componentCount: 1 | 2 | 3 | 4;
    readonly normalized: boolean;
    readonly byteStride: number;
    readonly byteOffset?: number;
};

export interface VertexAttributes {
    readonly position: VertexAttributeData;
    readonly normal: VertexAttributeData | null;
    readonly material: VertexAttributeData | null;
    readonly objectId: VertexAttributeData | null;
    readonly texCoord: VertexAttributeData | null;
    readonly color: VertexAttributeData | null;
    readonly deviation: VertexAttributeData | null;
    readonly triplets: readonly [VertexAttributeData, VertexAttributeData, VertexAttributeData] | null;
}

export interface SubMesh {
    readonly materialType: MaterialType;
    readonly primitiveType: PrimitiveTypeString;
    readonly vertexAttributes: VertexAttributes;
    readonly numVertices: number;
    readonly numTriplets: number;
    readonly objectRanges: readonly MeshObjectRange[];
    // either index range (if index buffer is defined) for use with drawElements(), or vertex range for use with drawArray()
    readonly drawRanges: readonly MeshDrawRange[];
    readonly vertexBuffers: readonly ArrayBuffer[];
    readonly indices: Uint16Array | Uint32Array | number; // Index buffer, or # vertices of none
    readonly baseColorTexture: number | undefined; // texture index
}

export interface NodeTexture {
    readonly semantic: TextureSemantic;
    readonly transform: readonly number[]; // 3x3 matrix
    readonly params: TextureParams;
}

// node geometry and textures
export interface NodeGeometry {
    readonly subMeshes: readonly SubMesh[];
    readonly textures: readonly (NodeTexture | undefined)[];
}

function getVec3(v: Float3 | Double3, i: number) {
    return vec3.fromValues(v.x[i], v.y[i], v.z[i]);
}

type Range = readonly [begin: number, end: number];

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
        case PrimitiveType.line_loops:
            return numIndices;
        case PrimitiveType.line_loops:
            return numIndices - 1;
        case PrimitiveType.triangles:
            return numIndices / 3;
        case PrimitiveType.triangle_strip:
            return numIndices - 2;
        case PrimitiveType.triangle_fan:
            return numIndices - 2;
    }
}

const vertexAttribs = {
    position: { type: Float16Array, components: ["x", "y", "z"] },
    normal: { type: Int8Array, components: ["x", "y", "z"] },
    color: { type: Uint32Array }, // RGBA8
    texCoord: { type: Float16Array, components: ["x", "y"] },
    deviation: { type: Float16Array },
    materialIndex: { type: Uint8Array },
    objectId: { type: Uint32Array },
} as const;
type VertexAttribNames = keyof typeof vertexAttribs;
type VertexAttrib = { readonly type: typeof vertexAttribs[VertexAttribNames]["type"], readonly components?: readonly string[]; };

function computeVertexOffsets(attribs: readonly VertexAttribNames[]) {
    let offset = 0;
    let offsets: any = {};
    function alignOffset(alignment: number) {
        const padding = alignment - 1 - (offset + alignment - 1) % alignment;
        offset += padding; // pad offset to be memory aligned.
    }
    let maxAlign = 1;
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

function getVertexAttribNames(optionalAttributes: OptionalVertexAttribute, hasMaterials: boolean, hasObjectIds: boolean) {
    const attribNames: VertexAttribNames[] = ["position"];
    if (optionalAttributes & OptionalVertexAttribute.normal) attribNames.push("normal");
    if (optionalAttributes & OptionalVertexAttribute.texCoord) attribNames.push("texCoord");
    if (optionalAttributes & OptionalVertexAttribute.color) attribNames.push("color");
    if (optionalAttributes & OptionalVertexAttribute.deviation) attribNames.push("deviation");
    if (hasMaterials) {
        attribNames.push("materialIndex");
    }
    if (hasObjectIds) {
        attribNames.push("objectId");
    }
    return attribNames;
}

export function aggregateSubMeshProjections(subMeshProjection: SubMeshProjection, range: Range, separatePositionBuffer: boolean, predicate?: (objectId: number) => boolean) {
    // const { subMeshProjection } = schema;
    const [begin, end] = range;
    let primitives = 0;
    let totalTextureBytes = 0;
    let totalNumIndices = 0;
    let totalNumVertices = 0;
    let totalNumVertexBytes = 0;

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
            const [pos, ...rest] = getVertexAttribNames(attributes, hasMaterials, hasObjectIds);
            const numBytesPerVertex = separatePositionBuffer ?
                computeVertexOffsets([pos]).stride + computeVertexOffsets(rest).stride :
                computeVertexOffsets([pos, ...rest]).stride;
            primitives += computePrimitiveCount(primitiveType, indices) ?? 0;
            totalNumIndices += indices;
            totalNumVertices += vertices;
            totalNumVertexBytes += vertices * numBytesPerVertex;
            totalTextureBytes += textureBytes;
        }
    }
    const idxStride = totalNumVertices < 0xffff ? 2 : 4;
    const gpuBytes = totalTextureBytes + totalNumVertexBytes + totalNumIndices * idxStride;
    return { primitives, gpuBytes } as const;
}

export function getChildren(parentId: string, schema: Schema, separatePositionBuffer: boolean, predicate?: (objectId: number) => boolean): NodeData[] {
    const { childInfo } = schema;
    var children: NodeData[] = [];
    const parentPrimitiveCounts: number[] = [];
    for (const mesh of getSubMeshes(schema, predicate)) {
        const { childIndex, indexRange, vertexRange } = mesh;
        const numIndices = indexRange[1] - indexRange[0];
        const numVertices = vertexRange[1] - vertexRange[0];
        const n = numIndices ? numIndices : numVertices;
        let count = parentPrimitiveCounts[childIndex] ?? 0;
        count += computePrimitiveCount(mesh.primitiveType, n) ?? 0;
        parentPrimitiveCounts[childIndex] = count;
    }

    for (let i = 0; i < childInfo.length; i++) {
        const childIndex = childInfo.childIndex[i];
        const childMask = childInfo.childMask[i];
        const id = parentId + childIndex.toString(32); // use radix 32 (0-9, a-v) encoding, which allows for max 32 children per node
        const tolerance = childInfo.tolerance[i];
        const byteSize = childInfo.totalByteSize[i];
        const offset = getVec3(childInfo.offset, i);
        const scale = childInfo.scale[i];
        const bounds: Bounds = {
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

        // const primitiveType = childInfo.primitiveType[i] as Exclude<PrimitiveType, PrimitiveType.undefined>;
        // const optionalAttributes = childInfo.attributes[i];
        const subMeshRange = getRange(childInfo.subMeshes, i);

        const parentPrimitives = parentPrimitiveCounts[i];
        const { primitives, gpuBytes } = aggregateSubMeshProjections(schema.subMeshProjection, subMeshRange, separatePositionBuffer, predicate);
        const primitivesDelta = primitives - (parentPrimitives ?? 0);
        // console.assert(primitivesDelta >= 0);
        children.push({ id, childIndex, childMask, tolerance, byteSize, offset, scale, bounds, primitives, primitivesDelta, gpuBytes });
    }
    return children;
}

export function* getSubMeshes(schema: Schema, predicate?: (objectId: number) => boolean) {
    const { subMesh } = schema;
    for (let i = 0; i < subMesh.length; i++) {
        const objectId = subMesh.objectId[i];
        if (predicate?.(objectId) ?? true) {
            const childIndex = subMesh.childIndex[i];
            const objectId = subMesh.objectId[i];
            const materialIndex = subMesh.materialIndex[i];
            const materialType = subMesh.materialType[i];
            const primitiveType = subMesh.primitiveType[i];
            const attributes = subMesh.attributes[i];
            const vertexRange = getRange(subMesh.vertices, i);
            const indexRange = getRange(subMesh.indices, i);
            const textureRange = getRange(subMesh.textures, i);
            yield { childIndex, objectId, materialIndex, materialType, primitiveType, attributes, vertexRange, indexRange, textureRange };
        }
    }
}

export function* getObjectIds(schema: Schema) {
    const { subMesh } = schema;
    for (let i = 0; i < subMesh.length; i++) {
        const objectId = subMesh.objectId[i];
        yield objectId;
    }
}

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array | Float32Array | Float64Array;

// Candidates for wasm implementation?
function copyToInterleavedArray<T extends TypedArray>(dst: T, src: T, byteOffset: number, byteStride: number, begin: number, end: number) {
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

function fillToInterleavedArray<T extends TypedArray>(dst: T, src: number, byteOffset: number, byteStride: number, begin: number, end: number) {
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

function getGeometry(schema: Schema, separatePositionBuffer: boolean, predicate?: (objectId: number) => boolean): NodeGeometry {
    const { vertex, vertexIndex } = schema;

    const filteredSubMeshes = [...getSubMeshes(schema, predicate)];

    let subMeshes: SubMesh[] = [];
    const referencedTextures = new Set<number>();

    // group submeshes into drawable meshes (with common attributes)
    type Group = {
        readonly materialType: number;
        readonly primitiveType: number;
        readonly attributes: number;
        // readonly childIndex: number;
        readonly subMeshIndices: number[];
    };
    const groups = new Map<string, Group>();
    for (let i = 0; i < filteredSubMeshes.length; i++) {
        const { materialType, primitiveType, attributes, childIndex } = filteredSubMeshes[i];
        const key = `${materialType}_${primitiveType}_${attributes}_${childIndex}`;
        let group = groups.get(key);
        if (!group) {
            group = { materialType, primitiveType, attributes, subMeshIndices: [] };
            groups.set(key, group);
        }
        group.subMeshIndices.push(i);
    }

    // create drawable meshes
    for (const { materialType, primitiveType, attributes, subMeshIndices } of groups.values()) {
        if (subMeshIndices.length == 0)
            continue;
        const groupMeshes = subMeshIndices.map(i => filteredSubMeshes[i]);
        const hasMaterials = groupMeshes.some(m => m.materialIndex != 0xff);
        const hasObjectIds = groupMeshes.some(m => m.objectId != 0xffffffff);

        const allAttribNames = getVertexAttribNames(attributes, hasMaterials, hasObjectIds);
        const [posName, ...extraAttribNames] = allAttribNames; // pop off positions since we're potentially putting them in a separate buffer
        const attribNames = separatePositionBuffer ? extraAttribNames : allAttribNames;
        const positionStride = computeVertexOffsets([posName]).stride;
        const tripletStride = positionStride;
        const attribOffsets = computeVertexOffsets(attribNames);
        const vertexStride = attribOffsets.stride;

        const childIndices = [...new Set<number>(groupMeshes.map(sm => sm.childIndex))].sort();
        let numVertices = 0;
        let numIndices = 0;
        let numTriplets = 0;
        for (let i = 0; i < groupMeshes.length; i++) {
            const sm = groupMeshes[i];
            const vtxCnt = sm.vertexRange[1] - sm.vertexRange[0];
            const idxCnt = sm.indexRange[1] - sm.indexRange[0];
            numVertices += vtxCnt;
            numIndices += idxCnt;
            numTriplets += Math.round((idxCnt > 0 ? idxCnt : vtxCnt) / 3);
        }
        const vertexBuffer = new ArrayBuffer(numVertices * vertexStride);
        const tripletBuffer = primitiveType >= PrimitiveType.triangles ? new Int16Array(new ArrayBuffer(numTriplets * 3 * tripletStride)) : undefined;
        const positionBuffer = separatePositionBuffer ? new ArrayBuffer(numVertices * positionStride) : undefined;
        let indexBuffer: Uint32Array | Uint16Array | undefined;
        if (vertexIndex) {
            indexBuffer = new (numVertices < 0xffff ? Uint16Array : Uint32Array)(numIndices);
        }
        let indexOffset = 0;
        let vertexOffset = 0;
        let tripletOffset = 0;
        let drawRanges: MeshDrawRange[] = [];
        type Mutable<T> = { -readonly [P in keyof T]: T[P] };
        const objectRanges: Mutable<MeshObjectRange>[] = [];

        for (const childIndex of childIndices) {
            const meshes = groupMeshes.filter(sm => sm.childIndex == childIndex);
            if (meshes.length == 0)
                continue;

            const drawRangeBegin = indexBuffer ? indexOffset : vertexOffset;

            for (const subMesh of meshes) {
                const { vertexRange, indexRange, materialIndex, objectId } = subMesh;
                const context = { materialIndex, objectId };
                const [beginVtx, endVtx] = vertexRange;
                const [beginIdx, endIdx] = indexRange;

                // create vertex buffer
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
                            copyToInterleavedArray(dst, src, offs, vertexStride, beginVtx, endVtx);
                        } else {
                            const src = Reflect.get(context, attribName) as number;
                            fillToInterleavedArray(dst, src, offs, vertexStride, beginVtx, endVtx);
                        }
                    }
                }

                // create triplet vertex buffer for clipping intersection
                if (tripletBuffer) {
                    const { x, y, z } = vertex.position;
                    if (vertexIndex && indexBuffer) {
                        for (let i = beginIdx; i < endIdx; i++) {
                            const idxIn = vertexIndex[i] + beginVtx;
                            tripletBuffer[tripletOffset++] = x[idxIn];
                            tripletBuffer[tripletOffset++] = y[idxIn];
                            tripletBuffer[tripletOffset++] = z[idxIn];
                        }
                    } else {
                        for (let i = beginVtx; i < endVtx; i++) {
                            tripletBuffer[tripletOffset++] = x[i];
                            tripletBuffer[tripletOffset++] = y[i];
                            tripletBuffer[tripletOffset++] = z[i];
                        }
                    }
                }

                if (positionBuffer) {
                    // create separate positions buffer
                    const i16 = new Int16Array(positionBuffer, vertexOffset * positionStride);
                    copyToInterleavedArray(i16, vertex.position.x, 0, positionStride, beginVtx, endVtx);
                    copyToInterleavedArray(i16, vertex.position.y, 2, positionStride, beginVtx, endVtx);
                    copyToInterleavedArray(i16, vertex.position.z, 4, positionStride, beginVtx, endVtx);
                }

                // create index buffer (if any)
                if (vertexIndex && indexBuffer) {
                    for (let i = beginIdx; i < endIdx; i++) {
                        indexBuffer[indexOffset++] = vertexIndex[i] + vertexOffset;
                    }
                }

                // update object ranges
                const prev = objectRanges.length - 1;
                if (prev >= 0 && objectRanges[prev].objectId == objectId) {
                    objectRanges[prev].endVertex = endVtx; // merge with previous entry
                } else {
                    objectRanges.push({ objectId, beginVertex: vertexOffset, endVertex: vertexOffset + endVtx - beginVtx });
                }

                vertexOffset += endVtx - beginVtx;
            }

            const drawRangeEnd = indexBuffer ? indexOffset : vertexOffset;
            const byteOffset = drawRangeBegin * (indexBuffer ? indexBuffer.BYTES_PER_ELEMENT : vertexStride);
            const count = drawRangeEnd - drawRangeBegin;
            drawRanges.push({ childIndex, byteOffset, first: drawRangeBegin, count });
        }
        console.assert(vertexOffset == numVertices);
        console.assert(indexOffset == numIndices);
        console.assert(tripletOffset == (tripletBuffer?.length ?? 0));
        const indices = indexBuffer ?? numVertices;

        const [beginTexture, endTexture] = groupMeshes[0].textureRange;
        let baseColorTexture: number | undefined;
        if (endTexture > beginTexture) {
            console.assert(beginTexture + 2 == endTexture);
            const textureRes = 0; // TODO: Adjust from device profile/resolution
            baseColorTexture = beginTexture + textureRes;
        }

        if (baseColorTexture != undefined) {
            referencedTextures.add(baseColorTexture);
        }

        const stride = vertexStride;
        const buffer = 0;
        const vertexBuffers: ArrayBuffer[] = [vertexBuffer];
        if (tripletBuffer) {
            vertexBuffers.push(tripletBuffer.buffer);
        }
        if (positionBuffer) {
            vertexBuffers.push(positionBuffer);
        }
        const posBufferIndex = positionBuffer ? tripletBuffer ? 2 : 1 : 0;
        const vertexAttributes = {
            position: { kind: "FLOAT_VEC4", buffer: posBufferIndex, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: attribOffsets["position"], byteStride: separatePositionBuffer ? 0 : stride },
            normal: (attributes & OptionalVertexAttribute.normal) != 0 ? { kind: "FLOAT_VEC3", buffer, componentCount: 3, componentType: "UNSIGNED_BYTE", normalized: true, byteOffset: attribOffsets["normal"], byteStride: stride } : null,
            material: hasMaterials ? { kind: "UNSIGNED_INT", buffer, componentCount: 1, componentType: "UNSIGNED_BYTE", normalized: false, byteOffset: attribOffsets["materialIndex"], byteStride: stride } : null,
            objectId: hasObjectIds ? { kind: "UNSIGNED_INT", buffer, componentCount: 1, componentType: "UNSIGNED_INT", normalized: false, byteOffset: attribOffsets["objectId"], byteStride: stride } : null,
            texCoord: (attributes & OptionalVertexAttribute.texCoord) != 0 ? { kind: "FLOAT_VEC2", buffer, componentCount: 2, componentType: "HALF_FLOAT", normalized: false, byteOffset: attribOffsets["texCoord"], byteStride: stride } : null,
            color: (attributes & OptionalVertexAttribute.color) != 0 ? { kind: "FLOAT_VEC4", buffer, componentCount: 4, componentType: "UNSIGNED_BYTE", normalized: true, byteOffset: attribOffsets["color"], byteStride: stride } : null,
            deviation: (attributes & OptionalVertexAttribute.deviation) != 0 ? { kind: "FLOAT", buffer, componentCount: 1, componentType: "HALF_FLOAT", normalized: false, byteOffset: attribOffsets["deviation"], byteStride: stride } : null,
            triplets: tripletBuffer ? [
                { kind: "FLOAT_VEC4", buffer: 1, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: 0, byteStride: 18 },
                { kind: "FLOAT_VEC4", buffer: 1, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: 6, byteStride: 18 },
                { kind: "FLOAT_VEC4", buffer: 1, componentCount: 3, componentType: "SHORT", normalized: true, byteOffset: 12, byteStride: 18 }
            ] : null,
        } as const satisfies VertexAttributes;

        objectRanges.sort((a, b) => (a.objectId - b.objectId));

        subMeshes.push({ materialType, primitiveType: primitiveTypeStrings[primitiveType], numVertices, numTriplets, objectRanges, vertexAttributes, vertexBuffers, indices, baseColorTexture, drawRanges });
    }

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
        const params = KTX.parseKTX(ktx);
        textures[i] = { semantic, transform, params };
    }

    return { subMeshes, textures } as const satisfies NodeGeometry;
}

export async function parseNode(id: string, separatePositionBuffer: boolean, version: string, buffer: ArrayBuffer, filterObjectIds: (ids: Uint32Array) => Promise<Uint32Array | undefined>) {
    console.assert(version == "1.7");
    // const begin = performance.now();
    const r = new BufferReader(buffer);
    var schema = readSchema(r);
    async function filter() {
        let objectIds: Uint32Array | undefined = new Uint32Array(new Set<number>(getObjectIds(schema)));
        objectIds.sort();
        objectIds = await filterObjectIds(objectIds);
        return objectIds ? new Set<number>(objectIds) : undefined;
    }
    const filteredObjectIds = await filter();
    const predicate = filteredObjectIds ? (objectId: number) => (filteredObjectIds.has(objectId)) : undefined;
    // const predicate = (objectId: number) => (true);
    const childInfos = getChildren(id, schema, separatePositionBuffer, predicate);
    const geometry = getGeometry(schema, separatePositionBuffer, predicate);
    // const end = performance.now();
    // console.log((end - begin));
    return { childInfos, geometry } as const;
}
