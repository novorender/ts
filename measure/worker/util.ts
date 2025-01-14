import { vec3, glMatrix, mat4, vec2 } from "gl-matrix";
import type { ReadonlyVec3, ReadonlyVec2 } from "gl-matrix";
import type { CylinderData, ProductData } from "./brep";
import { cylinderCenterLine } from "./calculations";
import { matFromInstance } from "./loader";
import { requestOfflineFile } from "offline/file";
import { MeasureTool } from "./scene";
import { getEdgeStrip } from "./outline";
glMatrix.setMatrixArrayType(Array);

export async function swapCylinderImpl(product: ProductData, faceIdx: number, instanceIdx: number, to: "inner" | "outer"): Promise<number | undefined> {
    const faceData = product.faces[faceIdx];
    if (faceData.surface === undefined) {
        return;
    }
    const surfaceData = product.surfaces[faceData.surface];

    if (surfaceData.kind == "cylinder") {
        const cylinderData = surfaceData as CylinderData;
        const mat = matFromInstance(product.instances[instanceIdx]);
        const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
            product,
            faceData,
            cylinderData,
            mat,
            "center"
        );
        let selectedIdx: number | undefined = undefined;
        let currentRadius = surfaceData.radius;
        const loopShell = async (shellIdx: number) => {
            const shell = product.shells[shellIdx];
            for (const currentFaceIdx of shell.faces) {
                if (currentFaceIdx != faceIdx) {
                    const face = product.faces[currentFaceIdx];
                    if (face.surface === undefined) {
                        continue;
                    }
                    const surface = product.surfaces[face.surface];
                    if (surface.kind == "cylinder") {
                        if (
                            (to == "outer" && surface.radius > currentRadius) ||
                            (to == "inner" && surface.radius < currentRadius)
                        ) {
                            const [currentCylinderOrigo, currentCylinderEnd] =
                                await cylinderCenterLine(
                                    product,
                                    face,
                                    surface,
                                    mat,
                                    "center"
                                );
                            if (
                                vec3.dist(currentCylinderOrigo, cylinderOrigo) < 0.01 &&
                                vec3.dist(currentCylinderEnd, cylinderEnd) < 0.01
                            ) {
                                selectedIdx = currentFaceIdx;
                                currentRadius = surface.radius;
                            }
                        }
                    }
                }
            }
        }

        for (const instance of product.instances) {
            const geom = product.geometries[instance.geometry as number];
            if (geom.shells) {
                for (const shellIdx of geom.shells) {
                    await loopShell(shellIdx);
                }
            }
            if (geom.solids) {
                for (const solidIdx of geom.solids) {
                    const solid = product.solids[solidIdx];
                    await loopShell(solid.outerShell);
                }
            }
        }
        return selectedIdx;
    }
}

export function closestPointToLine(
    point: ReadonlyVec3,
    lineStart: ReadonlyVec3,
    lineEnd: ReadonlyVec3,
    projectedPoint?: vec3
): { pos: vec3; parameter: number } {
    const t = projectPoint(point, lineStart, lineEnd);
    if (projectedPoint) {
        vec3.lerp(projectedPoint, lineStart, lineEnd, t);
    }
    if (t < 0) {
        return { pos: lineStart as vec3, parameter: 0 };
    }
    if (t > 1) {
        return { pos: lineEnd as vec3, parameter: 1 };
    }
    return { pos: vec3.lerp(vec3.create(), lineStart, lineEnd, t), parameter: t };
}

export function projectPoint(point: ReadonlyVec3, lineStart: ReadonlyVec3, lineEnd: ReadonlyVec3) {
    const lineVec = vec3.sub(vec3.create(), lineEnd, lineStart);
    const startToP = vec3.sub(vec3.create(), point, lineStart);
    const t = vec3.dot(lineVec, startToP) / vec3.dot(lineVec, lineVec);
    return t;
}

export function transformedLineData(
    vertices: ReadonlyVec3[],
    tesselationParameters: readonly number[] | undefined,
    transform: mat4 | undefined
): { line: ReadonlyVec3[], profile: ReadonlyVec2[] } {
    const profile: ReadonlyVec2[] = [];
    const line: ReadonlyVec3[] = [];
    let prev = transform
        ? vec3.transformMat4(vec3.create(), vertices[0], transform)
        : vertices[0];
    let len = 0;
    profile.push(
        tesselationParameters
            ? vec2.fromValues(tesselationParameters[0], prev[2])
            : vec2.fromValues(len, prev[2])
    );
    line.push(prev);
    for (let i = 1; i < vertices.length; ++i) {
        const p = transform
            ? vec3.transformMat4(vec3.create(), vertices[i], transform)
            : vertices[i];
        if (tesselationParameters) {
            profile.push(vec2.fromValues(tesselationParameters[i], p[2]));
            line.push(p);
        } else {
            len += vec2.distance(
                vec2.fromValues(prev[0], prev[1]),
                vec2.fromValues(p[0], p[1])
            );
            profile.push(vec2.fromValues(len, p[2]));
            line.push(p);
        }
        prev = p;
    }
    return { line, profile };
}

export function reduceLineStrip(lineStrip: ReadonlyVec3[]): ReadonlyVec3[] {
    const reducedStrip: ReadonlyVec3[] = [];
    if (lineStrip.length > 0) {
        let prevPoint = lineStrip[0];
        reducedStrip.push(prevPoint);
        for (let i = 0; i < lineStrip.length; ++i) {
            const currentPoint = lineStrip[i];
            if (vec3.distance(prevPoint, currentPoint) > 0.005) {
                reducedStrip.push(currentPoint);
            }
            prevPoint = currentPoint;
        }
    }
    return reducedStrip;
}

export class Downloader {
    activeDownloads = 0;
    constructor(public baseUrl?: URL) { }

    async request(
        filename: string,
        onlineRequestInit?: RequestInit
    ) {
        const url = new URL(filename, this.baseUrl);
        if (!url.search) url.search = this.baseUrl?.search ?? "";
        const request = new Request(url, { mode: "cors" });
        const response = await requestOfflineFile(request) ??
            await fetch(request, { mode: "cors", ...onlineRequestInit });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}: ${response.statusText}`);
        }
        return response;
    }

    async downloadJson(
        filename: string,
    ): Promise<any> {
        try {
            this.activeDownloads++;
            const response = await this.request(filename);
            return await response.json();
        } finally {
            this.activeDownloads--;
        }
    }

    async downloadJsonWithSize(
        filename: string,
    ): Promise<{ product: any, size: number }> {
        try {
            this.activeDownloads++;
            const response = await this.request(filename);
            const text = await response.text();
            return {
                product: JSON.parse(text), size: text.length
            };
        } finally {
            this.activeDownloads--;
        }
    }

    async downloadArrayBuffer(filename: string) {
        const response = await this.request(filename);
        return await response.arrayBuffer();
    }
}

export function getEdgeStripFromIdx(product: ProductData, edgeIdx: number, instanceIdx: number) {
    const edgeCurve = MeasureTool.geometryFactory.getCurve3DFromEdge(
        product,
        edgeIdx
    );
    if (edgeCurve) {
        const edge = {
            curve: edgeCurve,
            geometryTransformation: matFromInstance(
                product.instances[instanceIdx]
            ),
            instanceIndex: instanceIdx,
        };
        return getEdgeStrip(edge, 1);
    }
}