import type { ReadonlyVec2 } from "gl-matrix";
export { ProfileModule } from "./module";


/** 2d profile with slope information */
export interface Profile {
    readonly profilePoints: ReadonlyVec2[];
    /** slope between points for n and n -1 */
    readonly slopes: number[];
    /** Highetst Z value on the profile */
    readonly top: number;
    /** Lowest Z value on the profile */
    readonly bottom: number;
    /** Start Z value of the profile */
    readonly startElevation: number;
    /** End Z value of the profile */
    readonly endElevation: number;
}
