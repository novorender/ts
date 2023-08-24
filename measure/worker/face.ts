import { vec2, glMatrix } from "gl-matrix";
import type { ReadonlyMat4, ReadonlyVec2 } from "gl-matrix";
import type { Curve2D } from "./curves";
import type { IndexPair, Triangulation } from "./brep";
import type { Ray } from "./ray";
import type { Surface } from "./surfaces";

glMatrix.setMatrixArrayType(Array);

const projectedPoint = vec2.create();
const projectedTangent = vec2.create();
const beginUV = vec2.create();
const endUV = vec2.create();

export interface Seam {
    vertexIndexPairs: IndexPair[]; // pairs of face vertex indices that form part of a seam, i.e. they are different in UV space, but not in 3D.
}

export class Face {
    constructor(readonly surface: Surface, readonly sense: 1 | -1, readonly loops: readonly (readonly Curve2D[])[], readonly triangulation: Triangulation, readonly seams: Seam[], readonly instanceIndex: number, readonly geometryTransformation?: ReadonlyMat4) {
        // TODO: Check cone ray intersection. Seems to be an issue with sense (works if surface gets negative sense, but face doesnt).
        // const uv = vec2.fromValues(3.14, -35);
        // const pos = vec3.create();
        // surface.evalPosition(pos, uv);
        // const invUV = vec2.create();
        // surface.invert(invUV, pos);
        // for (const curves of loops) {
        //     if (curves.length > 1) {
        //         for (let i0 = 0; i0 < curves.length; i0++) {
        //             let i1 = (i0 + 1) % curves.length;
        //             const c0 = curves[i0];
        //             const c1 = curves[i1];
        //             c0.eval(c0.endParam, endUV, undefined);
        //             c1.eval(c1.beginParam, beginUV, undefined);
        //             const distUV = vec2.distance(beginUV, endUV);
        //             console.assert(distUV < 1e-5);
        //             const t = c1.project(beginUV);
        //             const distT = Math.abs(t - c1.beginParam);
        //             console.assert(distT < 1e-3);
        //         }
        //     }
        // }
    }

    raytrace(uvOut: vec2, ray: Ray): boolean {
        if (!this.surface.intersect(uvOut, ray)) return false;
        // return this.isInside(uvOut);
        return true;
    }

    isInside(uv: ReadonlyVec2): boolean {
        const { loops, sense } = this;
        let nearestDist = Number.MAX_VALUE;
        let inside = true;
        for (const curves of loops) {
            for (const curve of curves) {
                const t = curve.project(uv);
                curve.eval(t, projectedPoint, projectedTangent);
                const dist = vec2.distance(uv, projectedPoint);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    vec2.sub(projectedPoint, uv, projectedPoint);
                    const [tx, ty] = projectedTangent;
                    // rotate tangent 90 deg clockwise, such that it points away from the interior of the curve
                    projectedTangent[0] = ty * sense;
                    projectedTangent[1] = -tx * sense;
                    inside = vec2.dot(projectedTangent, projectedPoint) < 0;
                }
            }
        }
        return inside;
    }
}
