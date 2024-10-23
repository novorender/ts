import type { DrawObject, LaserIntersections, MeasureView, MeasureWorker, ObjectId } from "measure";
import { BaseModule } from "../base";
import type { ReadonlyVec3 } from "gl-matrix";

/**
 * Functionm for lasers on parametric data. DrawModule can be used to draw the results.
 * @internal
 */

export class LaserModule extends BaseModule {

    constructor(readonly worker: MeasureWorker, readonly parent: MeasureView) {
        super(worker, parent);
    }

    async getLaserintersections(id: ObjectId,
        faceIdx: number,
        instanceIdx: number,
        position: ReadonlyVec3): Promise<{ drawObject: DrawObject, laserValues: LaserIntersections } | undefined> {
        const workerScene = await this.worker;


        return await workerScene.getLaserObject(
            id,
            faceIdx,
            instanceIdx,
            position,
        );
    }

}