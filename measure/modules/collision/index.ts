import { vec3 } from "gl-matrix";

export { CollisionModule } from "./module"

/** Collision values*/
export interface CollisionValues {
    /** Collision point between two objects*/
    readonly point: vec3;
}