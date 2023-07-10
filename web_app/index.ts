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
export const packageVersion = process.env.NPM_PACKAGE_VERSION ?? '';

glMatrix.setMatrixArrayType(Array);
