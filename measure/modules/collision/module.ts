import type { CollisionValues } from ".";
import { BaseModule } from "../base";
import type { MeasureSettings, MeasureView, MeasureWorker, ParametricEntity } from "../../measure_view";

/** 
 * Module for all collision calculations
 */

export class CollisionModule {
    constructor(readonly worker: MeasureWorker, readonly parent: MeasureView) { }

    /** 
     * Returns collision values between 2 entities
     * currently only works for two cylinders
     */
    async collision(
        a: ParametricEntity,
        b: ParametricEntity,
        setting?: MeasureSettings
    ): Promise<CollisionValues | undefined> {
        if (a.drawKind == "face" && b.drawKind == "face") {
            const workerScene = await this.worker;
            return await workerScene.faceToFaceCollision(a.ObjectId,
                a.pathIndex,
                a.instanceIndex,
                b.ObjectId,
                b.pathIndex,
                b.instanceIndex,
                setting)
        }
        return undefined;
    }

}