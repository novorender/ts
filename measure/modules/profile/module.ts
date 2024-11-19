import { vec2, type ReadonlyVec2 } from "gl-matrix";
import type { MeasureEntity, MeasureSettings, ObjectId } from "../../measure_view";
import { MeasureError, } from "../../measure_view";
import { type Profile } from "..";
import { BaseModule } from "../base";

/**
 * Module for converting parametric data to profiles. which can easily be used for charts and graphs
 */
export class ProfileModule extends BaseModule {

    /** 
     * Returns the profile view of a linestrip where x is the length of the line and y is the height
     * This function can be used if an object contains multiple unconnected entities.
     * @param entity The parametric entity used to create the profile
     * @param setting Settings
     * @returns Profile where x is the length of the line and y is the height,
     *  it supports curve segments and cylinders, othwerwise it retuns undefiend
     */
    async viewFromEntity(
        entity: MeasureEntity,
        setting?: MeasureSettings
    ): Promise<Profile | undefined> {
        const workerScene = await this.worker;
        switch (entity.drawKind) {
            case "curveSegment": {
                return await workerScene.curveSegmentProfile(
                    entity.ObjectId,
                    entity.pathIndex,
                    entity.instanceIndex
                );
            }
            case "face": {
                return await workerScene.cylinderProfile(
                    entity.ObjectId,
                    entity.pathIndex,
                    entity.instanceIndex,
                    setting
                );
            }
        }
        return undefined;
    }

    /**
    * Returns the profile view of selected objects where x is the length of the line and y is the height,
    * currently only supports cylinders
    * @param products Products used to create a profile, this can be a list of line segments, line strips or connected cylinders
     * @param setting Settings
    * @returns Profile where x is the length of the line and y is the height,
    *  it supports curve segments and cylinders, othwerwise it retuns undefiend
    */
    async viewFromMultiSelect(
        products: ObjectId[],
        setting?: MeasureSettings
    ): Promise<Profile | undefined> {
        const workerScene = await this.worker;
        const profile = await workerScene.multiSelectProfile(products, setting);
        if (typeof profile === "string") {
            throw new MeasureError("Profile error", profile);
        }
        return profile;
    }

    reverse(inProfile: Profile): Profile {
        const endParam =
            inProfile.profilePoints[inProfile.profilePoints.length - 1][0];
        const rProfile: ReadonlyVec2[] = [];
        for (let i = inProfile.profilePoints.length - 1; i >= 0; --i) {
            const p = inProfile.profilePoints[i];
            rProfile.push(vec2.fromValues((p[0] - endParam) * -1, p[1]));
        }
        return {
            profilePoints: rProfile,
            startElevation: inProfile.endElevation,
            endElevation: inProfile.startElevation,
            top: inProfile.top,
            bottom: inProfile.bottom,
        };
    }
}