import { glMatrix } from "gl-matrix";
import { View } from "./view";
import { getDeviceProfile } from "./device";
import type { DeviceProfile } from "core3d/device";
export * from "../core3d";
export * from "./view";
export * from "./controller";
export * from "./serviceWorker";
export type { DeviceProfile } from "core3d/device";
export { getDeviceProfile };

glMatrix.setMatrixArrayType(Array);


export function createView(canvas: HTMLCanvasElement, options?: { deviceProfile?: DeviceProfile }) {
    const deviceProfile = options?.deviceProfile ?? getDeviceProfile(0);
    return new View(canvas, deviceProfile);
}