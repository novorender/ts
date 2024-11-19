import type { ReadonlyVec2 } from "gl-matrix";
import type { SlopeSegment } from "measure";
export { ProfileModule } from "./module";



/** 2d profile with slope information */
export interface Profile {
    readonly profilePoints: ReadonlyVec2[];
    /** Highetst Z value on the profile */
    readonly top: number;
    /** Lowest Z value on the profile */
    readonly bottom: number;
    /** Start Z value of the profile */
    readonly startElevation: number;
    /** End Z value of the profile */
    readonly endElevation: number;
}
