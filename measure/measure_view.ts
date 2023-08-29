import * as Comlink from "comlink";
import type { MeasureTool, Service } from "./worker";
import type { ReadonlyQuat, ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import { CollisionModule, DrawModule, FollowModule, ManholeModule, CoreModule, ProfileModule, RoadModule } from "./modules";
import type { DrawContext } from "./modules";
import { measure } from "core3d/benchmark/util";
import type { MeasureImports } from "./imports";
export * from "./modules";


/** @ignore */
export type MeasureWorker = Comlink.Remote<MeasureTool & Comlink.ProxyMarked>;

/**
 * Master class for all measure functionality 
 * The functionality is split into seperate modules
 */
export class MeasureView {

    /**
     * Module for collision calculations, see {@link CollisionModule}
     */
    collision: CollisionModule;
    /**
     * Module for drawing measure objects on screen, see {@link DrawModule}
     */
    draw: DrawModule;
    /**
     * Module for following parameteric objects such as line strips and cylinders, see {@link FollowModule}
     */
    followPath: FollowModule;
    /**
     * Module for inspecting and measuring manholes, see {@link ManholeModule}
     */
    manhole: ManholeModule;
    /**
     * Module for general measuring functions, see {@link CoreModule}
     */
    core: CoreModule;
    /**
     * Module for 2d profiles from lines or cylinders, see {@link ProfileModule}
     */
    profile: ProfileModule;
    /**
     * Module for road spesific calulations and data, see {@link RoadModule}
     */
    road: RoadModule;


    /** @ignore */
    private workers: ReturnType<typeof createWorkers>;

    /** @ignore */
    constructor(readonly worker: MeasureWorker, workers: ReturnType<typeof createWorkers>, readonly drawContext: DrawContext) {
        this.workers = workers;
        this.collision = new CollisionModule(worker, this);
        this.draw = new DrawModule(worker, this, drawContext);
        this.followPath = new FollowModule(worker, this);
        this.manhole = new ManholeModule(worker, this);
        this.core = new CoreModule(worker, this);
        this.profile = new ProfileModule(worker, this);
        this.road = new RoadModule(worker, this);
    }

    async loadScene(sceneUrl: URL) {
        const workerScene = await this.worker;
        workerScene.loadScene(sceneUrl.toString());
    }

    /**
     * Cleanup if measure module is no longer needed
     */
    async dispose(): Promise<void> {
        const { workers } = this;
        if (workers) {
            const { measure } = workers;
            await measure.service.terminate();
            measure.service[Comlink.releaseProxy]();
        }
    }
}

/** @ignore */
function createWorkers(url: string) {
    const measureWorker = new Worker(url, { type: "module", name: "Measure" });
    const measureService = Comlink.wrap<Service>(measureWorker);
    const workers = {
        measure: {
            worker: measureWorker,
            service: measureService,
        },
    };
    measureService.initialize(url);
    return workers;
}

/**
 * Creates a measure view based on the scene url.
 */
export async function createMeasureView(drawContext: DrawContext, imports: MeasureImports) {
    const workers = createWorkers(imports.measureWorker.toString());
    const tool = await workers.measure.service.createMeasureTool();
    const measureView = new MeasureView(tool, workers, drawContext);
    await tool.init(imports.nurbsWasm);
    return measureView;
}

/**
 * Base class for spesific errors from the measure API.
 */
export class MeasureError extends Error {
    constructor(readonly type: string, message: string) {
        super(message);
    }
}

/** 
 * Interface often used in the measure api to describe a selected parametric object,
 * It can either be an object or a simple 3d point
 * Any measure entity can be drawn using the draw module {@link DrawModule}
*/
export type MeasureEntity = ParametricEntity | PointEntity;

/** 
 * Object Id from the core 3d api. this is the way objects are linked between the general 3d api and the measure api
 */
export type ObjectId = number;

/** 
 * Camera values needed when drawing measure data. The camera state from RenderState can be used here {@link RenderStateCamera}
 */
export interface Camera {
    readonly kind: "pinhole" | "orthographic";
    readonly position: ReadonlyVec3;
    readonly rotation: ReadonlyQuat;
    readonly fov: number;
    readonly near: number;
    readonly far: number;
}

/** 
 * This is the identification of a spesific edge, face or curve segment in the object. 
 * It is often required by measure functions 
 */
export interface ParametricEntity {
    /** Object Id from the core 3d api. */
    ObjectId: ObjectId;
    /** the type of object that can be drawn from this spesific entity, see  {@link DrawModule} */
    drawKind: "edge" | "face" | "curveSegment";
    /** @ignore */
    pathIndex: number;
    /** @ignore */
    instanceIndex: number;
    /** @ignore */
    parameter?: number | ReadonlyVec2 | ReadonlyVec3;
}


export interface PointEntity {
    /** Object Id from the core 3d api. */
    ObjectId: ObjectId;
    /** Point entity will always draw as a single vertex from the draw module, see  {@link DrawModule}*/
    drawKind: "vertex";
    /** @ignore */
    pathIndex?: number;
    /** @ignore */
    instanceIndex?: number;
    /** @ignore */
    parameter: ReadonlyVec3;
}


const cylinderOptions = [
    "center",
    "closest",
    "furthest",
    "top",
    "bottom",
] as const;

type CylinderOptions = typeof cylinderOptions;

/** Possible options when measuring and drawing cylinders */
export type CylinerMeasureType = {
    [K in keyof CylinderOptions]: CylinderOptions[K] extends string
    ? CylinderOptions[K]
    : never;
}[keyof CylinderOptions];

/** Additional options for measurement */
export interface MeasureSettings {
    /** Where to measure cylinder from, in case of measure between two cylinder, same option will be used for both*/
    cylinderMeasure: CylinerMeasureType;
}