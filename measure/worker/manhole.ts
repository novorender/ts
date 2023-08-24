import { mat4, type ReadonlyVec3, vec3 } from "gl-matrix";
import type { CylinderData, FaceData, ProductData, SurfaceData } from "./brep";
import { cylinderLength } from "./calculations";
import { extractCylinderValues, extractPlaneValues } from "./extract_values";
import { crawlInstance, matFromInstance, unitToScale } from "./loader";
import type { Surface } from "./surfaces";
import type { ManholeMeasureValues, ObjectId } from "measure";
import { MeasureTool } from "./scene";

type PlaneEntity = { faceData: FaceData; instanceIdx: number, planeData: SurfaceData, faceIdx: number }
type CylinderEntity = { faceData: FaceData; instanceIdx: number, cylinderData: CylinderData, faceIdx: number }

export async function manholeMeasure(product: ProductData, prodId: ObjectId): Promise<ManholeMeasureValues | undefined> {
    let top: { elevation: number; entity: PlaneEntity } | undefined = undefined;
    let botInner: { elevation: number; radius: number | undefined, entity: PlaneEntity } | undefined = undefined;
    let botOuter: { elevation: number; radius: number | undefined, entity: PlaneEntity } | undefined = undefined;
    let outer: { radius: number; entity: CylinderEntity } | undefined = undefined;
    let inner: { radius: number; entity: CylinderEntity } | undefined = undefined;

    const botInnerCandiates: { elevation: number; radius: number | undefined, entity: PlaneEntity }[] = [];

    for (let i = 0; i < product.instances.length; ++i) {
        const instanceData = product.instances[i];
        const instanceMat = matFromInstance(instanceData);

        function faceFuncPlane(faceIdx: number) {
            if (product) {
                const face = product.faces[faceIdx];
                let radius: number | undefined = undefined;
                const outerLoop = product.loops[face.outerLoop];
                if (outerLoop.halfEdges.length == 1) {
                    const halfEdge = product.halfEdges[outerLoop.halfEdges[0]];
                    const edge = product.edges[halfEdge.edge];
                    if (edge.curve3D != undefined) {
                        const curve = product.curves3D[edge.curve3D];
                        if (curve.kind == "circle") {
                            radius = curve.radius;
                        }
                    }
                }
                const surf = product.surfaces[face.surface];
                if (surf.kind == "plane") {
                    const transform = mat4.fromValues(
                        ...(surf.transform as Parameters<typeof mat4.fromValues>)
                    );
                    mat4.multiply(transform, instanceMat, transform);
                    const planeDir = vec3.fromValues(transform[8], transform[9], transform[10]);
                    if (Math.abs(vec3.dot(planeDir, vec3.fromValues(0, 0, 1))) < 0.8) {
                        return;
                    }
                    const planePos = vec3.fromValues(0, 0, 0);
                    vec3.transformMat4(planePos, planePos, transform);
                    if (top === undefined || botInner === undefined || botOuter === undefined) {
                        top = { elevation: planePos[2], entity: { faceData: face, instanceIdx: i, planeData: surf, faceIdx } };
                        botInner = { elevation: planePos[2], radius, entity: { faceData: face, instanceIdx: i, planeData: surf, faceIdx } };
                        botOuter = { elevation: planePos[2], radius, entity: { faceData: face, instanceIdx: i, planeData: surf, faceIdx } };
                    } else {
                        if (top.elevation < planePos[2]) {
                            top = { elevation: planePos[2], entity: { faceData: face, instanceIdx: i, planeData: surf, faceIdx } };
                        }
                        else {
                            let setOuter = false;
                            if (radius === undefined) {
                                setOuter = botOuter.elevation > planePos[2]
                            } else {
                                if (botOuter.radius == undefined) {
                                    setOuter = botOuter.elevation > planePos[2];
                                }
                                else {
                                    setOuter = radius > botOuter.radius || (botOuter.radius === radius && botOuter.elevation > planePos[2]);
                                }
                            }
                            if (setOuter) {
                                botOuter = { elevation: planePos[2], radius, entity: { faceData: face, instanceIdx: i, planeData: surf, faceIdx } };
                            }
                            if (radius != undefined) {
                                botInnerCandiates.push({ elevation: planePos[2], radius, entity: { faceData: face, instanceIdx: i, planeData: surf, faceIdx } });
                            }

                        }
                    }
                }
            }
        }

        if (typeof instanceData.geometry == "number") {
            //check geom is number
            crawlInstance(product, instanceData, faceFuncPlane);
            botInnerCandiates.forEach(plane => {
                const { radius, elevation } = plane;
                if (botInner && botOuter && radius) {
                    let setInner = false;
                    if (botInner.radius == undefined) {
                        setInner = radius != undefined || botOuter.elevation > elevation
                    }
                    else {
                        setInner = botOuter.radius != undefined && botOuter.radius >= radius && botInner.elevation > elevation && elevation > botOuter.elevation;
                    }
                    if (setInner) {
                        botInner = plane;
                    }
                }
            });
        }
    }

    top = top as { elevation: number; entity: PlaneEntity } | undefined;
    botOuter = botOuter as { elevation: number; radius: number | undefined, entity: PlaneEntity } | undefined;
    if (!top || !botOuter) {
        return undefined;
    }
    if (top.elevation == botOuter.elevation) {
        return undefined;
    }
    const totalLength = top.elevation - botOuter.elevation;
    const scale = unitToScale(product.units);
    if (totalLength * scale < 0.1) {
        return undefined;
    }

    const getCylinderTopBot = (origo: ReadonlyVec3, dir: ReadonlyVec3, l: number, transformElevation: number) => {
        const flipped = dir[2] <= 0;
        const t = vec3.scaleAndAdd(vec3.create(), origo, dir, flipped ? l * -1 : l);
        return t[2] > origo[2] ? [t[2] + transformElevation, origo[2] + transformElevation] : [origo[2] + transformElevation, t[2] + transformElevation];
    }


    let letInnerCylinderTopBot: number[] | undefined = undefined;
    for (let i = 0; i < product.instances.length; ++i) {
        const instanceData = product.instances[i];
        function faceFuncCylinder(faceIdx: number) {
            if (product) {
                const face = product.faces[faceIdx];
                const surf = product.surfaces[face.surface];
                if (surf.kind == "cylinder") {
                    const cylinderMtx = mat4.fromValues(
                        ...(surf.transform as Parameters<typeof mat4.fromValues>)
                    );
                    const cylinderOrigo = mat4.getTranslation(vec3.create(), cylinderMtx);
                    const cylinderDir = vec3.fromValues(
                        cylinderMtx[8],
                        cylinderMtx[9],
                        cylinderMtx[10]
                    );

                    if (Math.abs(vec3.dot(cylinderDir, vec3.fromValues(0, 0, 1))) < 0.8) {
                        return;
                    }
                    const transformElevation = instanceData.transformation ? instanceData.transformation[14] : 0;

                    const len = Math.abs(cylinderLength(product, face, cylinderOrigo, cylinderDir));
                    if (len > totalLength / 3) {
                        if (outer == undefined || inner == undefined) {
                            outer = { radius: surf.radius, entity: { faceData: face, instanceIdx: i, cylinderData: surf, faceIdx } };
                            inner = { radius: surf.radius, entity: { faceData: face, instanceIdx: i, cylinderData: surf, faceIdx } };
                            letInnerCylinderTopBot = getCylinderTopBot(cylinderOrigo, cylinderDir, len, transformElevation);
                        } else {
                            if (outer.radius < surf.radius) {
                                outer = { radius: surf.radius, entity: { faceData: face, instanceIdx: i, cylinderData: surf, faceIdx } };
                            } else if (inner.radius > surf.radius) {
                                inner = { radius: surf.radius, entity: { faceData: face, instanceIdx: i, cylinderData: surf, faceIdx } };
                                letInnerCylinderTopBot = getCylinderTopBot(cylinderOrigo, cylinderDir, len, transformElevation);
                            }
                        }
                    }
                }
            }
        }

        if (typeof instanceData.geometry == "number") {
            //check geom is number
            crawlInstance(product, instanceData, faceFuncCylinder);
        }
    }



    if (top && botOuter && outer && inner && botInner) {
        const scale = unitToScale(product.units);
        top = top as { elevation: number; entity: PlaneEntity };
        const topPlane = MeasureTool.geometryFactory.getSurface(
            top.entity.planeData,
            top.entity.faceData.facing,
            scale
        );
        botOuter = botOuter as { elevation: number; radius: number | undefined, entity: PlaneEntity };
        botInner = botInner as { elevation: number; radius: number | undefined, entity: PlaneEntity };
        inner = inner as { radius: number; entity: CylinderEntity };
        outer = outer as { radius: number; entity: CylinderEntity };
        const oneCylinder = inner.radius === outer.radius;
        if (oneCylinder) {
            botInner = undefined;
        }
        else if (letInnerCylinderTopBot) {
            if (botInner.elevation >= letInnerCylinderTopBot[0]) {
                botInner = undefined;
            }
        }


        const botOuterPlane = MeasureTool.geometryFactory.getSurface(
            botOuter.entity.planeData,
            botOuter.entity.faceData.facing,
            scale
        );

        const botInnerPlane = botInner ? MeasureTool.geometryFactory.getSurface(
            botInner.entity.planeData,
            botInner.entity.faceData.facing,
            scale
        ) : undefined;

        return {
            drawKind: "manhole",
            ObjectId: prodId,
            top: await extractPlaneValues(prodId, top.entity.faceIdx, product, top.entity.instanceIdx, top.entity.faceData, topPlane, scale),
            topElevation: top.elevation,
            bottomOuter: await extractPlaneValues(prodId, botOuter.entity.faceIdx, product, botOuter.entity.instanceIdx, botOuter.entity.faceData, botOuterPlane, scale),
            bottomOuterElevation: botOuter.elevation,
            bottomInner: botInner ? await extractPlaneValues(prodId, botInner.entity.faceIdx, product, botInner.entity.instanceIdx, botInner.entity.faceData, botInnerPlane as Surface, scale) : undefined,
            bottomInnerElevation: botInner ? botInner.elevation : letInnerCylinderTopBot ? letInnerCylinderTopBot[1] : undefined,
            inner: oneCylinder ? undefined : await extractCylinderValues(prodId, inner.entity.faceIdx, product, inner.entity.instanceIdx, inner.entity.faceData, inner.entity.cylinderData, scale),
            innerRadius: oneCylinder ? undefined : inner.radius,
            outer: await extractCylinderValues(prodId, outer.entity.faceIdx, product, outer.entity.instanceIdx, outer.entity.faceData, outer.entity.cylinderData, scale),
            outerRadius: outer.radius,
            internal: {
                top: top.entity.faceData,
                bottomOuter: botOuter.entity.faceData,
                bottomInner: botInner ? botInner.entity.faceData : undefined,
                inner: oneCylinder ? undefined : inner.entity.faceData,
                outer: outer.entity.faceData,
            }
        }
    }
    return undefined;
}