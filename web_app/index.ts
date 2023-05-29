import { WebApp, type AppState } from "./app";
import { glMatrix } from "gl-matrix";
export * from "../core3d";
// export type { DeviceProfile } from "core3d/device";
export * from "./app";
export * from "./controller";


glMatrix.setMatrixArrayType(Array);

export function createWebApp(canvas: HTMLCanvasElement, viewState: AppState) {
    const app = new WebApp(canvas, viewState);
    return app;
}