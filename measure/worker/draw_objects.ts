import { type ReadonlyVec3, vec2, vec3 } from "gl-matrix";
import type { CylinderData, FaceData, LoopData, ProductData } from "./brep";
import { cylinderCenterLine } from "./calculations";
import { matFromInstance } from "./loader";
import { getEdgeStrip } from "./outline";
import type { DrawObject, DrawPart, DrawVoid, ManholeMeasureValues, MeasureSettings } from "measure";
import { MeasureTool } from "./scene";

export async function getCylinderDrawParts(product: ProductData, instanceIdx: number, cylinderData: CylinderData,
    face: FaceData, setting?: MeasureSettings) {
    const drawParts: DrawPart[] = [];
    const loop = product.loops[face.outerLoop];
    const mat = matFromInstance(product.instances[instanceIdx]);
    const [cylinderOrigo, cylinderEnd] = await cylinderCenterLine(
        product,
        face,
        cylinderData,
        mat,
        setting ? setting.cylinderMeasure : "center"
    );
    const diff = vec3.sub(vec3.create(), cylinderEnd, cylinderOrigo);
    const length = vec3.length(diff);
    const planarLength = vec2.len(vec2.fromValues(diff[0], diff[1]));
    const epsilon = 1e-3;
    const dir = vec3.normalize(vec3.create(), diff);
    const vertical = Math.abs(Math.abs(dir[2]) - 1) < epsilon;
    drawParts.push({
        vertices3D: [cylinderOrigo, cylinderEnd],
        drawType: "lines",
        elevation: {
            from: cylinderOrigo[2],
            to: cylinderEnd[2],
            horizontalDisplay: diff[2] < planarLength,
        },
        text: [[`L ${length.toFixed(3)}m   ⌀ ${(cylinderData.radius * 2).toFixed(3)}m   ${vertical ? "" : `% ${((Math.abs(diff[2] / planarLength)) * 100).toFixed(2)}`}`]]
    });
    for (const halfEdgeIdx of loop.halfEdges) {
        const halfEdgeData = product.halfEdges[halfEdgeIdx];
        const edgeData = product.edges[halfEdgeData.edge];
        if (edgeData.virtual) {
            continue;
        }
        const edgeCurve = MeasureTool.geometryFactory.getCurve3DFromEdge(
            product,
            halfEdgeData.edge
        );
        if (edgeCurve) {
            const edge = {
                curve: edgeCurve,
                geometryTransformation: matFromInstance(
                    product.instances[instanceIdx]
                ),
                instanceIndex: instanceIdx,
            };
            drawParts.push({
                vertices3D: getEdgeStrip(edge, 1),
                drawType: "lines",
            });
        }
    }

    drawParts.push({ drawType: 'text', vertices3D: [cylinderEnd], text: `Z: ${cylinderEnd[2].toFixed(3)}m` })
    drawParts.push({ drawType: 'text', vertices3D: [cylinderOrigo], text: `Z: ${cylinderOrigo[2].toFixed(3)}m` })

    return drawParts;
}

export async function getSurfaceDrawParts(product: ProductData, instanceIdx: number, face: FaceData) {
    const loop = product.loops[face.outerLoop];
    const drawParts: DrawPart[] = [];
    async function loopToVertices(loop: LoopData): Promise<{ vertices: ReadonlyVec3[], text: string[] }> {
        const vertices: ReadonlyVec3[] = [];
        const hasLineOnEitherSide: boolean[] = [];
        const text: string[] = [];
        if (product) {
            let first = true;
            for (const halfEdgeIdx of loop.halfEdges) {
                const halfEdgeData = product.halfEdges[halfEdgeIdx];

                const edgeCurve = MeasureTool.geometryFactory.getCurve3DFromEdge(
                    product,
                    halfEdgeData.edge
                );
                if (edgeCurve) {
                    const isLine = edgeCurve.kind == "line" || edgeCurve.kind == "lineStrip";
                    const edge = {
                        curve: edgeCurve,
                        geometryTransformation: matFromInstance(
                            product.instances[instanceIdx]
                        ),
                        instanceIndex: instanceIdx,
                    };
                    const edgeStrip = getEdgeStrip(edge, halfEdgeData.direction);
                    const startIdx = first ? 0 : vertices.length - 1;
                    if (!first && isLine) {
                        hasLineOnEitherSide[startIdx]
                    }
                    let i = first ? 0 : 1;
                    first = false;
                    for (; i < edgeStrip.length; ++i) {
                        vertices.push(edgeStrip[i]);
                        hasLineOnEitherSide.push(isLine);
                    }
                }
            }

        }
        if (vertices.length > 4 && vertices.length < 15) { //We assume that more than 15 is either a tesselated complex object or a tesselated circle 
            let prev = vec3.sub(vec3.create(), vertices[vertices.length - 2], vertices[0]);
            let next = vec3.create();
            for (let i = 0; i < vertices.length - 1; ++i) {
                next = vec3.sub(vec3.create(), vertices[i + 1], vertices[i]);
                if (hasLineOnEitherSide[i]) {
                    text.push(vec3.length(next).toFixed(3));
                    const prevIdx = i == 0 ? vertices.length - 2 : i - 1;
                    if (hasLineOnEitherSide[prevIdx] && hasLineOnEitherSide[i + 1]) {
                        const angle = vec3.angle(prev, next) * (180 / Math.PI);
                        if (angle > 0.1) {
                            drawParts.push({
                                text: angle.toFixed(1) + "°", drawType: "angle", vertices3D:
                                    [vec3.clone(vertices[i]), vec3.clone(vertices[prevIdx]), vec3.clone(vertices[i + 1])]
                            });
                        }
                    }

                } else {
                    text.push("");
                }
                vec3.negate(next, next);
                prev = next;
            }
        }
        return { vertices, text };
    }

    const text: string[][] = [];
    const { vertices: outerVerts, text: outerTexts } = await loopToVertices(loop);
    text.push(outerTexts);

    const voids: DrawVoid[] = [];
    if (face.innerLoops) {
        for (const innerLoopIdx of face.innerLoops) {
            const innerLoop = product.loops[innerLoopIdx];
            const { vertices: innerVerts, text: innerTexts } = await loopToVertices(innerLoop);
            text.push(innerTexts);
            voids.push({ vertices3D: innerVerts });
        }
    }
    drawParts.push({ vertices3D: outerVerts, drawType: "filled", voids, text: text.length > 0 ? text : undefined });
    return drawParts;
}

export async function getManholeDrawObjects(product: ProductData, manhole: ManholeMeasureValues) {
    const drawObjects: DrawObject[] = [];
    drawObjects.push({
        kind: "plane", parts: await getSurfaceDrawParts(product, manhole.top.entity!.instanceIndex, manhole.internal.top)
    });
    drawObjects.push({
        kind: "plane", parts: await getSurfaceDrawParts(product, manhole.bottomOuter.entity!.instanceIndex, manhole.internal.bottomOuter)
    });
    if (manhole.bottomInner && manhole.internal.bottomInner) {
        drawObjects.push({
            kind: "plane", parts: await getSurfaceDrawParts(product, manhole.bottomInner.entity!.instanceIndex, manhole.internal.bottomInner)
        });
    }
    const outerCylinder = product.surfaces[manhole.internal.outer.surface] as CylinderData;
    drawObjects.push({
        kind: "plane", parts: await getCylinderDrawParts(product, manhole.outer.entity!.instanceIndex, outerCylinder, manhole.internal.outer)
    });
    if (manhole.internal.inner && manhole.inner) {
        const innerCylinder = product.surfaces[manhole.internal.inner.surface] as CylinderData;
        drawObjects.push({
            kind: "plane", parts: await getCylinderDrawParts(product, manhole.inner.entity!.instanceIndex, innerCylinder, manhole.internal.inner)
        });
    }
    return drawObjects;
}
