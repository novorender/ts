import { mat4, vec3, type ReadonlyMat4, type ReadonlyVec4 } from "gl-matrix";

export function othoNormalBasisMatrixFromPlane(plane: ReadonlyVec4): ReadonlyMat4 {
    const [nx, ny, nz, offs] = plane;
    const t = ((Math.abs(nz) < Math.abs(nx)) ? [nz, 0, -nx] as const : [0, nz, -ny] as const);
    const normal = vec3.fromValues(nx, ny, nz);
    const tangent = vec3.fromValues(t[0], t[1], t[2]);
    vec3.normalize(tangent, tangent);
    const [tx, ty, tz] = tangent;
    const bitangent = vec3.cross(vec3.create(), normal, tangent);
    const [bx, by, bz] = bitangent;
    return mat4.fromValues(
        bx, tx, nx, 0,
        by, ty, ny, 0,
        bz, tz, nz, 0,
        nx * offs, ny * offs, nz * offs, 1
    );
}