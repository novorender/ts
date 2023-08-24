import type { ReadonlyMat4 } from "gl-matrix";
import type { Curve3D } from "./curves";

export class Edge {
    constructor(
        readonly curve: Curve3D,
        readonly geometryTransformation: ReadonlyMat4,
        readonly instanceIndex: number
    ) { }
}