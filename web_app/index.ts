/**
 * A library for building Novorender web apps.
 * @module
 */
import { glMatrix } from "gl-matrix";
export * from "../core3d";
export * from "./device";
export * from "./view";
export * from "./controller";
export * from "./serviceWorker";
export * from "./imports";
export const packageVersion = "env" in import.meta ? (import.meta as any).env.NPM_PACKAGE_VERSION : undefined ?? "beta";

glMatrix.setMatrixArrayType(Array);
