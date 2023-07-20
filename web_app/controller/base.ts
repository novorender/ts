import type { RenderStateCamera, RenderStateChanges, RecursivePartial, BoundingSphere, PickSample, PickOptions } from "core3d";
import { type ReadonlyVec3, type ReadonlyQuat, vec3 } from "gl-matrix";
import { ControllerInput } from "./input";
import type { FlightControllerParams } from "./flight";
import type { OrbitControllerParams } from "./orbit";
import type { OrthoControllerParams } from "./ortho";
import type { PanoramaControllerParams } from "./panorama";

export type ControllerParams = FlightControllerParams | OrthoControllerParams | PanoramaControllerParams | OrbitControllerParams;
export interface Orientation {
    readonly pos: ReadonlyVec3;
    readonly pitch: number;
    readonly yaw: number;
}
export interface FlyToParams {
    readonly totalFlightTime: number;
    readonly begin: Orientation;
    readonly end: Orientation;
}

interface FlyToExt extends FlyToParams {
    currentFlightTime: number;
    current: Orientation;
}

export abstract class BaseController {
    abstract readonly kind: string;
    abstract readonly projection: RenderStateCamera["kind"];
    abstract readonly changed: boolean;
    private flyTo: FlyToExt | undefined;
    private isMoving = false;

    constructor(readonly input: ControllerInput) {
        // this.connect();
        // this.axes = {} as ControllerAxes;
        // this.resetAxes();
    }

    dispose() {
        // this.disconnect();
    }

    get axes() {
        return this.input.axes;
    }

    get moving() {
        return this.isMoving;
    }

    get width() {
        return this.input.width;
    }

    get height() {
        return this.input.height;
    }

    get multiplier() {
        return this.input.multiplier;
    }

    get zoomPos() {
        return this.input.zoomPos;
    }

    get pointerTable() {
        return this.input.pointerTable;
    }

    get hasShift() {
        return this.input.hasShift;
    }

    get currentFlyTo() {
        return this.flyTo?.current;
    }

    protected setFlyTo(flyTo: FlyToParams) {
        // wrap begin yaw to nearest angular distance
        let { yaw } = flyTo.begin
        const target = flyTo.end.yaw;
        if (yaw - target < -180) yaw += 360;
        else if (yaw - target > 180) yaw -= 360;
        const begin = { ...flyTo.begin, yaw };
        this.flyTo = { ...flyTo, begin, currentFlightTime: 0, current: begin };
    }

    animate(elapsedTime: number) {
        if (elapsedTime < 0 || elapsedTime > 250) elapsedTime = 1000 / 60;
        this.input.animate(elapsedTime);
        const { flyTo } = this;
        if (flyTo) {
            if (flyTo.currentFlightTime >= flyTo.totalFlightTime) {
                this.flyTo = undefined;
            } else {
                flyTo.currentFlightTime += elapsedTime;
                const { currentFlightTime, totalFlightTime, begin, end, current } = flyTo;
                if (currentFlightTime < totalFlightTime) {
                    const lerp = (a: number, b: number, t: number) => (a + (b - a) * t);
                    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
                    const t = easeInOut(currentFlightTime / totalFlightTime);
                    const pos = vec3.lerp(vec3.create(), begin.pos, end.pos, t);
                    const pitch = lerp(begin.pitch, end.pitch, t);
                    let yaw = lerp(begin.yaw, end.yaw, t);
                    if (yaw < -180) yaw += 360;
                    else if (yaw > 180) yaw -= 360;
                    flyTo.current = { pos, yaw, pitch } as const;
                } else {
                    Object.assign(current, end);
                }
            }
        }
    }

    abstract serialize(includeDerived?: boolean): ControllerInitParams;
    abstract init(params: ControllerInitParams): void;
    abstract autoFit(center: ReadonlyVec3, radius: number): void;
    abstract update(): void;
    abstract stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera>;
    abstract updateParams(params: RecursivePartial<ControllerParams>): void;
    attach() {
        this.input.callbacks = this;
    }

    mouseButtonChanged(event: MouseEvent): Promise<void> | void { }
    touchChanged(event: TouchEvent): Promise<void> | void { }
    moveBegin(event: TouchEvent | MouseEvent): Promise<void> | void { }
    moveTo(targetPosition: ReadonlyVec3, flyTime: number = 1000, rotation?: ReadonlyQuat): void { }
    zoomTo(boundingSphere: BoundingSphere, flyTime: number = 1000): void { }

    renderStateChanges(state: RenderStateCamera, elapsedTime: number): RenderStateChanges | undefined {
        if (this.input.axesEmpty() && this.currentFlyTo == undefined) {
            this.isMoving = false;
            return;
        }
        this.isMoving = true;
        this.animate(elapsedTime);
        if (Object.values(this.input.axes).some(v => v != 0) || this.currentFlyTo || this.changed) { // check if anything has changed
            this.update();
            this.input.resetAxes();
            const changes = this.stateChanges(state);
            return Object.keys(changes).length ? { camera: changes } : undefined;
        }
    }

    protected static getDistanceFromViewPlane(point: ReadonlyVec3, cameraPosition: ReadonlyVec3, cameraRotation: ReadonlyQuat): number {
        const dir = vec3.fromValues(0, 0, -1);
        vec3.transformQuat(dir, dir, cameraRotation);
        const offset = -vec3.dot(dir, cameraPosition);
        return vec3.dot(point, dir) + offset;
    }
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
export type MutableCameraState = Partial<Mutable<RenderStateCamera>>;

export interface PickInterface {
    pick: (x: number, y: number, options?: PickOptions) => Promise<PickSample | undefined>;
}

export interface ControllerInitParams {
    readonly kind: string;
    readonly position?: ReadonlyVec3;
    readonly rotation?: ReadonlyQuat;
    readonly pivot?: ReadonlyVec3;
    readonly fovDegrees?: number;
    readonly fovMeters?: number;
    readonly distance?: number;
};