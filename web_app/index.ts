import { View, type AppState } from "./view";
import { glMatrix } from "gl-matrix";
export * from "../core3d";
// export type { DeviceProfile } from "core3d/device";
export * from "./view";
export * from "./controller";
export { View };

glMatrix.setMatrixArrayType(Array);

export function createView(canvas: HTMLCanvasElement) {
    return new View(canvas);
}