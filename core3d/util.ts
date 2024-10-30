import { mat4, vec3, type ReadonlyMat4, type ReadonlyVec4 } from "gl-matrix";

/** @internal */
export function decodeBase64(base64: string, type?: Uint8ArrayConstructor): Uint8Array;
export function decodeBase64(base64: string, type: Uint8ClampedArrayConstructor): Uint8ClampedArray;
export function decodeBase64(base64: string | undefined, type?: Uint8ArrayConstructor): Uint8Array | undefined;
export function decodeBase64(base64: string | undefined, type: Uint8ClampedArrayConstructor): Uint8ClampedArray | undefined;
export function decodeBase64(base64: string | undefined, type: Uint8ArrayConstructor | Uint8ClampedArrayConstructor = Uint8Array) {
    if (base64) {
        var binaryString = atob(base64);
        var len = binaryString.length;
        const bytes = new type(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
}

/** @internal */
export function orthoNormalBasisMatrixFromPlane(plane: ReadonlyVec4): ReadonlyMat4 {
    const [nx, ny, nz, offs] = plane;
    const axisZ = vec3.fromValues(nx, ny, nz);
    const minI = Math.abs(ny) < Math.cos(0.08726646) ? 1 : 2;  //Try to align y axis to up or if normal is already pointing up, then north. 5 degrees test
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