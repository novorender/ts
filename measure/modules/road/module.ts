import type { CrossSlope, RoadCrossSection, RoadProfiles } from "..";
import { BaseModule } from "../base";

/**
 * Module for handling road spesific parametric data. 
 */
export class RoadModule extends BaseModule {
    /**
     * @ignore
     * In development
     */
    async getProfile(roadId: string): Promise<RoadProfiles | undefined> {
        const workerScene = await this.worker;
        return workerScene.getRoadProfile(roadId);
    }

    /**
     * @ignore
     * In development
     */
    async getCrossSlope(roadId: string): Promise<CrossSlope | undefined> {
        const workerScene = await this.worker;
        return workerScene.getRoadCrossSlope(roadId);
    }

    /**
     * Get cross sections at a spesific profile in the road.
     * @param roadIds Unqiue string id for each road, can be found in the data api
     * @param profileNumber Distance along the center line where the cross section should be cut
     * @returns 
     */
    async getCrossSections(roadIds: string[], profileNumber: number): Promise<RoadCrossSection[]> {
        const workerScene = await this.worker;
        const sections = await Promise.all(roadIds.map((rId) => workerScene.getCrossSection(rId, profileNumber)));
        const s = sections.filter(s => s != undefined);
        return s as RoadCrossSection[];
    }

}