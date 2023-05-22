import { WebApp, type AppState } from "./app";
import { glMatrix } from "gl-matrix";

glMatrix.setMatrixArrayType(Array);

export function createWebApp(canvas: HTMLCanvasElement, viewState: AppState) {
    const app = new WebApp(canvas, viewState);
    return app;
}