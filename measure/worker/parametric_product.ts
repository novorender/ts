import type { EdgeValues, FaceValues, ObjectId } from "measure";
import type { LoopData, ProductData, ShellData } from "./brep";
import { extractCurveValues, extractFaceValues } from "./extract_values";
import { matFromInstance } from "./loader";

export interface ParametricEdge {
    index: number;
    values: EdgeValues | undefined;
}

export interface ParametricFace {
    index: number;
    values: FaceValues | undefined;
    outerLoop: ParametricEdge[];
    innerLoops?: ParametricEdge[][];
}

export interface ParametricSolid {
    volume?: number;
    outerShell: ParametricFace[];
    innerShells?: ParametricFace[][];
}

export interface ParametricGeometry {
    index: number;
    solids: ParametricSolid[];
}

export interface ParametricProduct {
    geometries: ParametricGeometry[];
}

export async function toParametricProduct(prodId: ObjectId, product: ProductData) {
    const handleLoop = async (
        loop: LoopData,
        instanceIdx: number
    ): Promise<ParametricEdge[] | undefined> => {
        const loopEdges: ParametricEdge[] = [];
        for (const halfEdgeIdx of loop.halfEdges) {
            const halfEdge = product!.halfEdges[halfEdgeIdx];
            loopEdges.push({
                index: halfEdge.edge,
                values: await extractCurveValues(
                    product,
                    halfEdge.edge,
                    instanceIdx,
                    "edge"
                ),
            });
        }
        return loopEdges;
    };
    const handleShell = async (
        shellData: ShellData,
        instanceIdx: number
    ): Promise<ParametricFace[] | undefined> => {
        const outerFaces: ParametricFace[] = [];
        for (const faceIdx of shellData.faces) {
            const faceData = product.faces[faceIdx];
            const outerLoop = await handleLoop(
                product.loops[faceData.outerLoop],
                instanceIdx
            );
            if (outerLoop == undefined) {
                return undefined;
            }
            let innerLoops: ParametricEdge[][] | undefined = undefined;
            if (faceData.innerLoops) {
                innerLoops = [];
                for (const loopIdx of faceData.innerLoops) {
                    const innerLoop = await handleLoop(
                        product.loops[loopIdx],
                        instanceIdx
                    );
                    if (innerLoop == undefined) {
                        return undefined;
                    }
                    innerLoops.push(innerLoop);
                }
            }
            outerFaces.push({
                index: faceIdx,
                outerLoop,
                innerLoops,
                values: await extractFaceValues(prodId, product, faceIdx, instanceIdx),
            });
            return outerFaces;
        }
    };
    const geometries: ParametricGeometry[] = [];
    for (let i = 0; i < product.instances.length; ++i) {
        const instanceData = product.instances[i];
        const mat = matFromInstance(instanceData);
        const geometryData = product.geometries[instanceData.geometry as number];
        const solids: ParametricSolid[] = [];
        let volume = 0;
        if (geometryData.shells) {
            for (const shellIdx of geometryData.shells) {
                const shellData = product.shells[shellIdx];
                if (shellData.volume) {
                    volume += shellData.volume;
                }

                const outerFaces = await handleShell(shellData, i);
                if (outerFaces) {
                    solids.push({
                        volume: volume == 0 ? undefined : volume,
                        outerShell: outerFaces,
                    });
                } else {
                    return undefined;
                }
            }
        }
        if (geometryData.solids) {
            for (const solidIdx of geometryData.solids) {
                const solidData = product.solids[solidIdx];
                const outerShellData = product.shells[solidData.outerShell];
                if (outerShellData.volume) {
                    volume += outerShellData.volume;
                }

                const outerShell = await handleShell(outerShellData, i);
                if (outerShell == undefined) {
                    return undefined;
                }
                let innerShells: ParametricFace[][] | undefined = undefined;
                if (solidData.innerShells) {
                    innerShells = [];
                    for (const shellIdx of solidData.innerShells) {
                        const innerShellData = product.shells[shellIdx];
                        if (innerShellData.volume) {
                            volume -= innerShellData.volume;
                        }
                        const innerShell = await handleShell(innerShellData, i);
                        if (innerShell == undefined) {
                            return undefined;
                        }
                        innerShells.push(innerShell);
                    }
                }
                solids.push({
                    volume: volume == 0 ? undefined : volume,
                    outerShell,
                    innerShells,
                });
            }
        }
        geometries.push({ index: i, solids });
    }
    return { geometries };
}
