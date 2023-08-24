import { BaseModule } from "../base";
import type { DrawObject } from "../draw";
import type { ManholeMeasureValues } from ".";


/**
 * Modules specialized for measuring manholes
 */
export class ManholeModule extends BaseModule {
    /** 
     * Give manhole measure object to inspect from objectId, 
     * note that this object can be used for all measurement {@link measure}
     * and aslo be drawn {@link DrawableEntity}
     * @param ObjectId The object Id where the api try to fetch manhole object from
     * @returns Values for manhole measurement, 
    */
    async measure(objectId: number): Promise<ManholeMeasureValues | undefined> {
        const workerScene = await this.worker;
        return workerScene.getManholeValues(objectId);
    }

    /**
     * @ignore
    */
    async getManholeDrawObject(entity: ManholeMeasureValues): Promise<DrawObject[]> {
        const workerScene = await this.worker;
        return workerScene.getManholeDrawObject(entity);
    }
}