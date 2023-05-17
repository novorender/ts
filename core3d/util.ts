import { mat4, vec3, type ReadonlyMat4, type ReadonlyVec4 } from "gl-matrix";

export function othoNormalBasisMatrixFromPlane(plane: ReadonlyVec4): ReadonlyMat4 {
    const [nx, ny, nz, offs] = plane;
    const axisZ = vec3.fromValues(nx, ny, nz);
    const minI = nx < ny && nx < nz ? 0 : ny < nz ? 1 : 2;
    const axisY = vec3.fromValues(0, 0, 0);
    axisY[minI] = 1;
    const axisX = vec3.cross(vec3.create(), axisY, axisZ);
    vec3.cross(axisX, axisY, axisZ);
    vec3.normalize(axisX, axisX);
    vec3.cross(axisY, axisZ, axisX);
    vec3.normalize(axisY, axisY);
    const [bx, by, bz] = axisX;
    const [tx, ty, tz] = axisY;
    return mat4.fromValues(
        bx, by, bz, 0,
        tx, ty, tz, 0,
        nx, ny, nz, 0,
        nx * -offs, ny * -offs, nz * -offs, 1
    );
}