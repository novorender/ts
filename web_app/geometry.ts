import { type ReadonlyVec2, type ReadonlyVec3, vec2, vec3, quat } from "gl-matrix";
import type { RenderState, RenderStateDynamicGeometry, RenderStateDynamicInstance, RenderStateDynamicMaterial, RenderStateDynamicMesh, RenderStateDynamicMeshPrimitive, RenderStateDynamicObject, RenderStateDynamicVertexAttributes } from "core3d/state";

const unlitMaterial: RenderStateDynamicMaterial = {
    kind: "unlit",
};

const defaultMaterial: RenderStateDynamicMaterial = {
    kind: "ggx",
    metallicFactor: 1,
    roughnessFactor: 0.1,
};

const defaultInstance: RenderStateDynamicInstance = {
    position: vec3.create(),
};

/** @internal */
export function createRandomInstances(count = 1, radius?: number) {
    const instances: RenderStateDynamicInstance[] = [];
    const r = radius ?? count <= 1 ? 0 : Math.pow(count, 1 / 3) * 2;
    const rndCoord = () => ((Math.random() * 2 - 1) * r);
    const rndAngle = () => (Math.random() * 360);
    for (var i = 0; i < count; i++) {
        const position = vec3.fromValues(rndCoord(), rndCoord(), rndCoord());
        if (vec3.sqrLen(position) > r * r) {
            i--;
            continue;
        }
        const rotation = quat.fromEuler(quat.create(), rndAngle(), rndAngle(), rndAngle());
        instances.push({ position, rotation })
    }
    return instances;
}

/**
 * Create a simple cube mesh object.
 * @param material The material to use, or undefined for default material.
 * @example
 * ```typescript
 * const cube = createCubeObject();
 * view.modifyRenderState({ dynamic: { objects: [cube] } });
 * ```
 * @beta
 */
export function createCubeObject(material?: RenderStateDynamicMaterial): RenderStateDynamicObject {
    const vertices = createCubeVertices((pos, norm, col) => ([...pos, ...norm, ...col]));
    const indices = createCubeIndices();
    material ??= defaultMaterial;

    const attributes = {
        position: { kind: "FLOAT_VEC3", buffer: vertices, byteStride: 36, byteOffset: 0 },
        normal: { kind: "FLOAT_VEC3", buffer: vertices, byteStride: 36, byteOffset: 12 },
        color0: { kind: "FLOAT_VEC3", buffer: vertices, byteStride: 36, byteOffset: 24 },
    } as const satisfies RenderStateDynamicVertexAttributes;

    const geometry: RenderStateDynamicGeometry = {
        primitiveType: "TRIANGLES",
        attributes,
        indices,
    };

    const primitive: RenderStateDynamicMeshPrimitive = { geometry, material };
    const mesh: RenderStateDynamicMesh = { primitives: [primitive] };
    const instances = [defaultInstance];
    return { mesh, instances };
}

function createCubeVertices(pack: (position: ReadonlyVec3, normal: ReadonlyVec3, color: ReadonlyVec3) => Iterable<number>) {
    function face(x: ReadonlyVec3, y: ReadonlyVec3, color: ReadonlyVec3) {
        const normal = vec3.cross(vec3.create(), y, x);
        function vert(fx: "add" | "sub", fy: "add" | "sub") {
            const pos = vec3.clone(normal);
            vec3[fx](pos, pos, x);
            vec3[fy](pos, pos, y);
            return pack(pos, normal, color);
        }
        return [
            ...vert("sub", "sub"),
            ...vert("add", "sub"),
            ...vert("sub", "add"),
            ...vert("add", "add"),
        ];
    }

    return new Float32Array([
        ...face([0, 0, -1], [0, 1, 0], [1, 0, 0]), // right (1, 0, 0)
        ...face([0, 0, 1], [0, 1, 0], [0, 1, 1]), // left (-1, 0, 0)
        ...face([1, 0, 0], [0, 0, 1], [0, 1, 0]), // top (0, 1, 0)
        ...face([1, 0, 0], [0, 0, -1], [1, 0, 1]), // bottom (0, -1, 0)
        ...face([1, 0, 0], [0, 1, 0], [0, 0, 1]), // front (0, 0, 1)
        ...face([-1, 0, 0], [0, 1, 0], [1, 1, 0]), // back (0, 0, -1)
    ])
}

function createCubeIndices() {
    let idxOffset = 0;
    function face() {
        const idx = [0, 2, 1, 1, 2, 3].map(i => i + idxOffset);
        idxOffset += 4;
        return idx;
    }
    return new Uint16Array([
        ...face(),
        ...face(),
        ...face(),
        ...face(),
        ...face(),
        ...face(),
    ]);
}


/**
 * Create a simple sphere mesh object.
 * @param detail The level of tesselation, expressed as # subdivisions of the base icosahedron.
 * @param material The material to use, or undefined for default material.
 * @example
 * ```typescript
 * const sphere = createSphereObject();
 * view.modifyRenderState({ dynamic: { objects: [sphere] } });
 * ```
 * @beta
 */
export function createSphereObject(detail = 5, material?: RenderStateDynamicMaterial): RenderStateDynamicObject {
    const radius = 1;
    const { positionBuffer, normalBuffer, texCoordBuffer } = icosahedron(radius, detail);

    material ??= defaultMaterial;

    const attributes = {
        position: { kind: "FLOAT_VEC3", buffer: positionBuffer },
        normal: { kind: "FLOAT_VEC3", buffer: normalBuffer },
        texCoord0: { kind: "FLOAT_VEC2", buffer: texCoordBuffer },
    } as const satisfies RenderStateDynamicVertexAttributes;

    const geometry: RenderStateDynamicGeometry = {
        primitiveType: "TRIANGLES",
        attributes,
        indices: positionBuffer.length / 3,
    };

    const primitive: RenderStateDynamicMeshPrimitive = { geometry, material };
    const mesh: RenderStateDynamicMesh = { primitives: [primitive] };
    return { mesh, instances: [defaultInstance] };
}

function icosahedron(radius: number, detail: number) {
    const t = (1 + Math.sqrt(5)) / 2;
    const vertices = [
        - 1, t, 0, 1, t, 0, - 1, - t, 0, 1, - t, 0,
        0, - 1, t, 0, 1, t, 0, - 1, - t, 0, 1, - t,
        t, 0, - 1, t, 0, 1, - t, 0, - 1, - t, 0, 1
    ];
    const indices = [
        0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
        1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
        3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
        4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1
    ];
    return polyhedron(vertices, indices, radius, detail);
}

function polyhedron(vertices: number[], indices: number[], radius: number, detail: number) {
    const vertexBuffer: number[] = [];
    const uvBuffer: number[] = [];

    // the subdivision creates the vertex buffer data
    subdivide(detail);

    // all vertices should lie on a conceptual sphere with a given radius
    applyRadius(radius);

    // finally, create the uv data
    generateUVs();

    // build non-indexed geometry
    const positionBuffer = new Float32Array(vertexBuffer);
    const normalBuffer = new Float32Array(vertexBuffer);
    const texCoordBuffer = new Float32Array(uvBuffer);

    if (detail == 0) {
        computeVertexNormals(); // flat normals
    } else {
        normalizeNormals(); // smooth normals
    }

    return { positionBuffer, normalBuffer, texCoordBuffer } as const;

    // helper functions
    function subdivide(detail: number) {
        const a = vec3.create();
        const b = vec3.create();
        const c = vec3.create();

        // iterate over all faces and apply a subdivision with the given detail value
        for (let i = 0; i < indices.length; i += 3) {
            // get the vertices of the face
            getVertexByIndex(indices[i + 0], a);
            getVertexByIndex(indices[i + 1], b);
            getVertexByIndex(indices[i + 2], c);

            // perform subdivision
            subdivideFace(a, b, c, detail);
        }
    }

    function subdivideFace(a: ReadonlyVec3, b: ReadonlyVec3, c: ReadonlyVec3, detail: number) {
        const cols = detail + 1;

        // we use this multidimensional array as a data structure for creating the subdivision
        const v: ReadonlyVec3[][] = [];

        // construct all of the vertices for this subdivision
        for (let i = 0; i <= cols; i++) {
            v[i] = [];
            const aj = vec3.lerp(vec3.create(), a, c, i / cols);
            const bj = vec3.lerp(vec3.create(), b, c, i / cols);
            const rows = cols - i;
            for (let j = 0; j <= rows; j++) {
                if (j === 0 && i === cols) {
                    v[i][j] = aj;
                } else {
                    v[i][j] = vec3.lerp(vec3.create(), aj, bj, j / rows);
                }
            }
        }

        // construct all of the faces
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < 2 * (cols - i) - 1; j++) {
                const k = Math.floor(j / 2);
                if (j % 2 === 0) {
                    pushVertex(v[i][k + 1]);
                    pushVertex(v[i + 1][k]);
                    pushVertex(v[i][k]);
                } else {
                    pushVertex(v[i][k + 1]);
                    pushVertex(v[i + 1][k + 1]);
                    pushVertex(v[i + 1][k]);
                }
            }
        }
    }

    function applyRadius(radius: number) {
        const vertex = vec3.create();
        // iterate over the entire buffer and apply the radius to each vertex
        for (let i = 0; i < vertexBuffer.length; i += 3) {
            vertex[0] = vertexBuffer[i + 0];
            vertex[1] = vertexBuffer[i + 1];
            vertex[2] = vertexBuffer[i + 2];
            vec3.scale(vertex, vec3.normalize(vertex, vertex), radius);
            vertexBuffer[i + 0] = vertex[0];
            vertexBuffer[i + 1] = vertex[1];
            vertexBuffer[i + 2] = vertex[2];
        }
    }

    function generateUVs() {
        const vertex = vec3.create();
        for (let i = 0; i < vertexBuffer.length; i += 3) {
            vertex[0] = vertexBuffer[i + 0];
            vertex[1] = vertexBuffer[i + 1];
            vertex[2] = vertexBuffer[i + 2];

            const u = azimuth(vertex) / 2 / Math.PI + 0.5;
            const v = inclination(vertex) / Math.PI + 0.5;
            uvBuffer.push(u, 1 - v);
        }
        correctUVs();
        correctSeam();
    }

    function correctSeam() {
        // handle case when face straddles the seam, see #3269
        for (let i = 0; i < uvBuffer.length; i += 6) {
            // uv data of a single face
            const x0 = uvBuffer[i + 0];
            const x1 = uvBuffer[i + 2];
            const x2 = uvBuffer[i + 4];

            const max = Math.max(x0, x1, x2);
            const min = Math.min(x0, x1, x2);

            // 0.9 is somewhat arbitrary
            if (max > 0.9 && min < 0.1) {
                if (x0 < 0.2) uvBuffer[i + 0] += 1;
                if (x1 < 0.2) uvBuffer[i + 2] += 1;
                if (x2 < 0.2) uvBuffer[i + 4] += 1;
            }
        }
    }

    function pushVertex(vertex: ReadonlyVec3) {
        vertexBuffer.push(...vertex);
    }

    function getVertexByIndex(index: number, vertex: vec3) {
        const stride = index * 3;
        vertex[0] = vertices[stride + 0];
        vertex[1] = vertices[stride + 1];
        vertex[2] = vertices[stride + 2];
    }

    function correctUVs() {
        const a = vec3.create();
        const b = vec3.create();
        const c = vec3.create();
        const centroid = vec3.create();

        const uvA = vec2.create();
        const uvB = vec2.create();
        const uvC = vec2.create();

        for (let i = 0, j = 0; i < vertexBuffer.length; i += 9, j += 6) {
            vec3.set(a, vertexBuffer[i + 0], vertexBuffer[i + 1], vertexBuffer[i + 2]);
            vec3.set(b, vertexBuffer[i + 3], vertexBuffer[i + 4], vertexBuffer[i + 5]);
            vec3.set(c, vertexBuffer[i + 6], vertexBuffer[i + 7], vertexBuffer[i + 8]);
            vec2.set(uvA, uvBuffer[j + 0], uvBuffer[j + 1]);
            vec2.set(uvB, uvBuffer[j + 2], uvBuffer[j + 3]);
            vec2.set(uvC, uvBuffer[j + 4], uvBuffer[j + 5]);

            vec3.add(centroid, a, b);
            vec3.add(centroid, centroid, c);
            vec3.scale(centroid, centroid, 1. / 3);

            const azi = azimuth(centroid);

            correctUV(uvA, j + 0, a, azi);
            correctUV(uvB, j + 2, b, azi);
            correctUV(uvC, j + 4, c, azi);
        }
    }

    function correctUV(uv: ReadonlyVec2, stride: number, vector: ReadonlyVec3, azimuth: number) {
        if ((azimuth < 0) && (uv[0] === 1)) {
            uvBuffer[stride] = uv[0] - 1;
        }
        if ((vector[0] === 0) && (vector[2] === 0)) {
            uvBuffer[stride] = azimuth / 2 / Math.PI + 0.5;
        }
    }

    // Angle around the Y axis, counter-clockwise when looking from above.
    function azimuth(vector: ReadonlyVec3) {
        return Math.atan2(vector[2], - vector[0]);
    }

    // Angle above the XZ plane.
    function inclination(vector: ReadonlyVec3) {
        return Math.atan2(- vector[1], Math.sqrt((vector[0] * vector[0]) + (vector[2] * vector[2])));
    }

    function computeVertexNormals() {
        if (positionBuffer !== undefined) {
            const cb = vec3.create(), ab = vec3.create();
            // non-indexed elements (unconnected triangle soup)
            for (let i = 0, il = positionBuffer.length; i < il; i += 9) {
                const pA = positionBuffer.subarray(i + 0, i + 3);
                const pB = positionBuffer.subarray(i + 3, i + 6);
                const pC = positionBuffer.subarray(i + 6, i + 9);
                vec3.sub(cb, pC, pB);
                vec3.sub(ab, pA, pB);
                vec3.cross(cb, cb, ab);
                vec3.normalize(cb, cb);
                vec3.copy(normalBuffer.subarray(i + 0, i + 3), cb);
                vec3.copy(normalBuffer.subarray(i + 3, i + 6), cb);
                vec3.copy(normalBuffer.subarray(i + 6, i + 9), cb);
            }
        }
    }

    function normalizeNormals() {
        for (let i = 0, il = normalBuffer.length; i < il; i += 3) {
            const normal = normalBuffer.subarray(i, i + 3);
            vec3.normalize(normal, normal);
        }
    }
}
