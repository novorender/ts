import { glMatrix } from "gl-matrix";
import { getDeviceProfile } from "./device";
export * from "../core3d";
export * from "./view";
export * from "./controller";
export * from "./serviceWorker";
export type { DeviceProfile } from "core3d/device";
export { getDeviceProfile };
export const packageVersion = "env" in import.meta ? ((import.meta) as any).env.NPM_PACKAGE_VERSION : undefined ?? "beta";

glMatrix.setMatrixArrayType(Array);
