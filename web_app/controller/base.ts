import { type RenderStateScene, type RenderStateCamera, type RenderState, type RenderStateChanges, type RenderContext, mergeRecursive, type RecursivePartial, type RenderStateGrid, type RenderStateClippingPlane, type RenderStateClipping, type BoundingSphere, type PickSample } from "core3d";
import { type ReadonlyVec3, vec2, type ReadonlyQuat, vec3, quat } from "gl-matrix";
import { ControllerInput } from "./input";
import type { FlightControllerParams } from "./flight";
import type { OrbitControllerParams } from "./orbit";
import type { OrthoControllerParams } from "./ortho";
import type { PanoramaControllerParams } from "./panorama";

export type ControllerParams = FlightControllerParams | OrthoControllerParams | PanoramaControllerParams | OrbitControllerParams;
export type FlytoObject = { remainingFlightTime: number, target: { pos: vec3, pitch: number, yaw: number }, current: { pos: vec3, pitch: number, yaw: number } }


export abstract class BaseController {
    abstract readonly kind: string;
    abstract readonly projection: RenderStateCamera["kind"];
    abstract readonly changed: boolean;
    private flyToObject: FlytoObject | undefined;

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
        return this.input.moving;
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
        return this.flyToObject ? this.flyToObject.current : undefined;
    }

    protected setFlyTo(flyTo: FlytoObject) {
        this.flyToObject = flyTo;
    }

    animate(elapsedTime: number) {
        if (elapsedTime < 0 || elapsedTime > 250) elapsedTime = 1000 / 60;
        this.input.animate(elapsedTime);
        const { flyToObject } = this;
        if (flyToObject) {
            const { remainingFlightTime, target, current } = flyToObject;
            if (remainingFlightTime > 0) {
                if (elapsedTime >= remainingFlightTime) {
                    this.flyToObject!.current = target;
                } else {
                    const e = elapsedTime / remainingFlightTime;
                    vec3.lerp(this.flyToObject!.current.pos, this.flyToObject!.current.pos, target.pos, e);
                    let dy = target.yaw - current.yaw;
                    if (dy < -180) dy += 360;
                    else if (dy > 180) dy -= 360;
                    this.flyToObject!.current.yaw += dy * e;
                    this.flyToObject!.current.pitch += (target.pitch - current.pitch) * e;
                }
                this.flyToObject!.remainingFlightTime -= elapsedTime;
            } else {
                this.flyToObject = undefined;
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
    moveTo(targetPosition: ReadonlyVec3, flyTime: number = 1000, rotation?: quat): void { }
    zoomTo(boundingSphere: BoundingSphere, flyTime: number = 1000): void { }

    renderStateChanges(state: RenderStateCamera, elapsedTime: number): RenderStateChanges | undefined {
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
    pick: (x: number, y: number, sampleDiscRadius: number) => Promise<PickSample | undefined>;
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