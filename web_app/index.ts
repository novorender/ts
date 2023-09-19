/**
 * A library for building Novorender web apps.
 * @module
 */
import { glMatrix } from "gl-matrix";
export * from "../core3d";
export * from "../offline";
export * from "../measure";
export * from "./device";
export * from "./view";
export * from "./controller";
export * from "./highlight";
export * from "./geometry";

declare const NPM_PACKAGE_VERSION: string | undefined;

/**
 * NPM package version, if applicable.
 */
export const packageVersion = NPM_PACKAGE_VERSION;

// THIS IS VERY IMPORTANT!!! MUST BE SET PRIOR TO CREATING ANY GL MATRICES, PREFERABLY AS THE FIRST LINE OF CODE IN THE WHOLE APP!
// Float32Array doesn't have enough resolution for scenes with georeferenced coordinates.
glMatrix.setMatrixArrayType(Array);
