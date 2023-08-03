import { type ReadonlyVec3, type ReadonlyQuat, vec3 } from "gl-matrix";
import type { RenderStateCamera, RenderStateChanges, RecursivePartial, BoundingSphere, PickSample, PickOptions } from "core3d";
import type { View } from "../";
import { ControllerInput } from "./input";
import type { FlightControllerParams } from "./flight";
import type { OrbitControllerParams } from "./orbit";
import type { OrthoControllerParams } from "./ortho";
import type { PanoramaControllerParams } from "./panorama";

/** Base class for all camera controllers. */
export abstract class BaseController {
    /** The controller type id. */
    abstract readonly kind: string;

    /** The camera projection kind.
     * @see {@link RenderStateCamera.kind}.
     * @virtual
     */
    abstract readonly projection: RenderStateCamera["kind"];

    /** Whether the camera has changed since last update or not.
     * @see {@link RenderStateCamera.kind}.
     * @virtual
     */
    abstract readonly changed: boolean;

    private flyTo: FlyToExt | undefined;
    private isMoving = false;

    /**
     * @param input The input source for this controller.
     */
    protected constructor(
        /** The input source for this controller. */
        readonly input: ControllerInput
    ) {
    }

    /** The input axes
     * @see {@link ControllerInput.axes}
     */
    get axes() {
        return this.input.axes;
    }

    /** Whether the camera is currently considered moving or not.
     * @see {@link View.isIdleFrame}
     */
    get moving() {
        return this.isMoving;
    }

    /** The input element width.
     * @see {@link ControllerInput.width}
     */
    get width() {
        return this.input.width;
    }

    /** The input element height.
     * @see {@link ControllerInput.height}
     */
    get height() {
        return this.input.height;
    }

    /** The input multiplier.
     * @see {@link ControllerInput.multiplier}
     */
    get multiplier() {
        return this.input.multiplier;
    }

    /** The input zoom position.
     * @see {@link ControllerInput.zoomPos}
     */
    get zoomPos() {
        return this.input.zoomPos;
    }

    /** The input pointer table.
     * @see {@link ControllerInput.touchPoints}
     */
    get pointerTable() {
        return this.input.touchPoints;
    }

    /** The input shift button state.
     * @see {@link ControllerInput.hasShift}
     */
    get hasShift() {
        return this.input.hasShift;
    }

    /** The current fly-to state, if any. */
    get currentFlyTo() {
        return this.flyTo?.current;
    }

    /** Initialize a fly-to transition.
     * @param flyTo The transition parameters
     */
    protected setFlyTo(flyTo: FlyToParams) {
        // wrap begin yaw to nearest angular distance
        let { yaw } = flyTo.begin
        const target = flyTo.end.yaw;
        if (yaw - target < -180) yaw += 360;
        else if (yaw - target > 180) yaw -= 360;
        const begin = { ...flyTo.begin, yaw };
        this.flyTo = { ...flyTo, begin, currentFlightTime: 0, current: begin };
    }

    /** Apply time sensitive changes to controller state.
     * @param elapsedTime The # of milliseconds elapsed since the last update.
     * @remarks
     * Fly-to animations happens here,
     * as well as motion based on keyboard pressed-state, such as the WASD keys.
     */
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

    /** Serialize the state of this controller into init parameters.
     * @param includeDerived Include derived state which may not be intrinsic to this controller, such as orbit controller position.
     * @see {@link init}
     */
    abstract serialize(includeDerived?: boolean): ControllerInitParams;

    /** Initialize controller from parameters.
     * @see {@link serialize}
     */
    abstract init(params: ControllerInitParams): void;

    /** Attempt to fit controller position such that the specified bounding sphere is brought into view.
     * @param center The center of the bounding sphere, in world space.
     * @param radius The radius of the bounding sphere, in world space.
     */
    abstract autoFit(center: ReadonlyVec3, radius: number): void;

    /** Update internal controller state */
    abstract update(): void;

    /** Retrieve changes to render state from derived class, if any.
     * @param state The baseline state to apply changes to.
     * @see {@link View.modifyRenderState}
     * @remarks
     * If there are no changes, the returned object will be empty, i.e. {}.
     * @virtual
     */
    abstract stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera>;

    /** Update state from partial parameters. */
    abstract updateParams(params: RecursivePartial<ControllerParams>): void;

    /** Attach this controller to the input object */
    attach() {
        this.input.callbacks = this;
    }

    /** 
     * Handler for mouse buttons events.
     * @virtual
     */
    mouseButtonChanged(event: MouseEvent): Promise<void> | void { }

    /** 
     * Handler for touch events.
     * @virtual
     */
    touchChanged(event: TouchEvent): Promise<void> | void { }

    /** 
     * Handler for mouse/touch move events.
     * @virtual
     */
    moveBegin(event: TouchEvent | MouseEvent): Promise<void> | void { }

    /** Move controller to specified position/rotation.
     * @param targetPosition: The position to move to, in world space.
     * @param flyTime: The time, in milliseconds, for the transition animation to last, or 0 for instant update.
     * @param rotation: Optional target rotation, or undefined to retain current rotation.
     */
    moveTo(targetPosition: ReadonlyVec3, flyTime: number = 1000, rotation?: ReadonlyQuat): void { }

    /** Bring the specified bounding sphere into view.
     * @param boundingSphere: The bounding sphere to move into view.
     * @param flyTime: The time, in milliseconds, for the transition animation to last, or 0 for instant update.
     * @remarks
     * This function will retain the current camera controller rotation.
     */
    zoomTo(boundingSphere: BoundingSphere, flyTime: number = 1000): void { }

    /** Retrieve the state changes to be applied to the specified render state.
     * @param state The baseline render state.
     * @param elapsedTime The time elapsed since last call, in milliseconds.
     */
    renderStateChanges(state: RenderStateCamera, elapsedTime: number): RenderStateChanges | undefined {
        this.animate(elapsedTime);
        if (this.input.axesEmpty() && this.currentFlyTo == undefined && !this.changed) {
            this.isMoving = false;
            return;
        }
        this.isMoving = true;
        if (Object.values(this.input.axes).some(v => v != 0) || this.currentFlyTo || this.changed) { // check if anything has changed
            this.update();
            this.input.resetAxes();
            const changes = this.stateChanges(state);
            return Object.keys(changes).length ? { camera: changes } : undefined;
        }
    }

    /** Compute the distance to a point from the specified view plane.
     * @param point The point to measure distance too
     * @param cameraPosition The position of the camera/view plane.
     * @param cameraRotation The rotation of the camera/view plane.
     * @returns A signed distance from the point to the view plane, i.e. positive for points in front of the plane and negative otherwise.
     */
    protected static getDistanceFromViewPlane(point: ReadonlyVec3, cameraPosition: ReadonlyVec3, cameraRotation: ReadonlyQuat): number {
        const dir = vec3.fromValues(0, 0, -1);
        vec3.transformQuat(dir, dir, cameraRotation);
        const offset = -vec3.dot(dir, cameraPosition);
        return vec3.dot(point, dir) + offset;
    }
}


/** Common controller input parameters. */
export type ControllerParams = FlightControllerParams | OrthoControllerParams | PanoramaControllerParams | OrbitControllerParams;

/** Camera controller 3D orientation in world space. */
export interface Orientation {
    /** Camera position. */
    readonly pos: ReadonlyVec3;
    /** Camera pitch angle in degrees. */
    readonly pitch: number;
    /** Camera yaw angle in degrees. */
    readonly yaw: number;
}

/** Camera fly-to transition/animation parameter */
export interface FlyToParams {
    /** Total flight time in milliseconds. */
    readonly totalFlightTime: number;
    /** The transition start camera orientation. */
    readonly begin: Orientation;
    /** The transition end camera orientation. */
    readonly end: Orientation;
}

/** @internal */
interface FlyToExt extends FlyToParams {
    currentFlightTime: number;
    current: Orientation;
}


type Mutable<T> = { -readonly [P in keyof T]: T[P] };

/** @internal */
export type MutableCameraState = Partial<Mutable<RenderStateCamera>>;

/** A context interface for pick operations.
 * @remarks
 * This is used by some controllers to determine the position and depth of point of screen to allow e.g. orbiting around said point.
 * You may pass {@link View} or {@link RenderContext} directly, or wrap some custom variant of picking in your own object.
 * @see {@link View.pick}
 *  */
export interface PickContext {
    pick: (x: number, y: number, options?: PickOptions) => Promise<PickSample | undefined>;
}

/** Common controller initialization parameters.
 * @remarks
 * No controller uses all of these parameters.
 * This interface represents the union of all possible intialization paramters for all possible controllers.
 * This is useful for deserialization, where the kind of controller is not known at compile time.
 */
export interface ControllerInitParams {
    /** The kind of controller to initialize. */
    readonly kind: string;

    /** The camera position, if applicable. */
    readonly position?: ReadonlyVec3;

    /** The camera rotation, if applicable. */
    readonly rotation?: ReadonlyQuat;

    /** The camera perspective field of view, in degrees, if applicable. */
    readonly fovDegrees?: number;

    /** The camera orthographic field of meters, in degrees, if applicable. */
    readonly fovMeters?: number;

    /** The camera pivot point, if applicable. */
    readonly pivot?: ReadonlyVec3;

    /** The distance to the pivot point, if applicable. */
    readonly distance?: number;
};