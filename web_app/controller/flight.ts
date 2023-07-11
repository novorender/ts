
import { type ReadonlyVec3, vec3, glMatrix, quat, mat3 } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState, type PickInterface } from "./base";
import { type RenderStateCamera, type RecursivePartial, mergeRecursive, type BoundingSphere } from "core3d";
import { PitchRollYawOrientation, clamp, decomposeRotation } from "./orientation";
import { ControllerInput, MouseButtons } from "./input";

export interface CameraTransformations {
    tx: number,
    ty: number,
    tz: number,
    rx: number,
    ry: number,
    shouldPivot: boolean
}

/** Ortho type camera motion controller */
export interface FlightControllerParams {
    position?: ReadonlyVec3;
    pitch?: number;
    yaw?: number;
    linearVelocity?: number;
    rotationalVelocity?: number;
    autoZoomSpeed?: boolean;
    flightTime?: number;
    fieldOfView?: number;
    pickDelay: number;
    proportionalCameraSpeed?: { min: number, max: number; };
}

interface Pivot {
    center: ReadonlyVec3;
    offset: ReadonlyVec3;
    distance: number;
    active: boolean;
}

export class FlightController extends BaseController {
    static readonly defaultParams = {
        position: [0, 0, 0],
        pitch: -30,
        yaw: 30,
        linearVelocity: 1,
        rotationalVelocity: 1,
        autoZoomSpeed: false,
        flightTime: 1,
        fieldOfView: 60,
        pickDelay: 200,
        proportionalCameraSpeed: { min: 0.2, max: 1000 }
    };

    override kind: string = "flight" as const;
    override projection = "pinhole" as const;
    override changed = false;
    protected pivotButton: MouseButtons = MouseButtons.right;
    protected pivotFingers: number = 3;
    private params;
    private position: ReadonlyVec3 = vec3.create();
    private readonly orientation = new PitchRollYawOrientation();
    private pivot: Pivot | undefined;
    private fov: number;

    private readonly resetPickDelay = 3000;
    private lastUpdatedMoveBegin: number = 0;
    private lastUpdate: number = 0;
    private recordedMoveBegin: ReadonlyVec3 | undefined = undefined;
    private inMoveBegin = false;
    private mouseOrTouchMoving = false;

    constructor(readonly pickInterface: PickInterface, input: ControllerInput, params?: FlightControllerParams) {
        super(input);
        this.params = { ...FlightController.defaultParams, ...params } as const;
        const { orientation } = this;
        const { pitch, yaw, fieldOfView } = this.params;
        orientation.pitch = pitch;
        orientation.yaw = yaw;
        this.fov = fieldOfView;
    }

    override serialize(): ControllerInitParams {
        const { kind, position, orientation, fov } = this;
        const { rotation } = orientation;
        this.changed = false;
        return { kind, position, rotation, fovDegrees: fov };
    }

    override init(params: ControllerInitParams) {
        const { kind, position, rotation, fovDegrees } = params;
        console.assert(kind == this.kind);
        if (position) {
            this.position = position;
        }
        if (rotation) {
            this.orientation.decomposeRotation(rotation);
            this.orientation.roll = 0;
        }
        if (fovDegrees != undefined) {
            this.fov = fovDegrees;
        }
        this.changed = false;
        this.input.callbacks = this;
        this.input.usePointerLock = true;
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
        const { orientation } = this;
        const maxDistance = 1000;
        const distance = Math.min(maxDistance, radius / Math.tan(glMatrix.toRadian(this.fov) / 2));
        const dir = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(dir, dir, orientation.rotation);
        this.position = vec3.add(vec3.create(), center, dir)
    }

    override updateParams(params: RecursivePartial<FlightControllerParams>) {
        this.params = mergeRecursive(this.params, params);
    }

    override moveTo(targetPosition: ReadonlyVec3, flyTime: number = 1000, rotation?: quat): void {
        const { orientation, position } = this;
        if (flyTime) {
            let targetPitch = orientation.pitch;
            let targetYaw = orientation.yaw;
            if (rotation) {
                const { pitch, yaw } = decomposeRotation(rotation)
                targetPitch = pitch / Math.PI * 180;
                targetYaw = yaw / Math.PI * 180;
            }

            this.setFlyTo({
                totalFlightTime: flyTime,
                end: { pos: vec3.clone(targetPosition), pitch: targetPitch, yaw: targetYaw },
                begin: { pos: vec3.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
            });
        }
        else {
            this.position = targetPosition;
            if (rotation) {
                this.orientation.decomposeRotation(rotation);
            }
            this.changed = true;
        }
    }

    override zoomTo(boundingSphere: BoundingSphere, flyTime: number = 1000): void {
        const { orientation, position, fov } = this;
        if (flyTime) {
            const dist = Math.max(boundingSphere.radius / Math.tan(glMatrix.toRadian(fov) / 2), boundingSphere.radius);
            const targetPosition = vec3.create();
            vec3.add(targetPosition, vec3.transformQuat(targetPosition, vec3.fromValues(0, 0, dist), orientation.rotation), boundingSphere.center);
            this.setFlyTo({
                totalFlightTime: flyTime,
                end: { pos: vec3.clone(targetPosition), pitch: orientation.pitch, yaw: orientation.yaw + 0.05 },
                begin: { pos: vec3.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
            });
        } else {
            const dist = boundingSphere.radius / Math.tan(glMatrix.toRadian(fov) / 2);
            this.position = vec3.add(vec3.create(), vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, dist), orientation.rotation), boundingSphere.center);
            this.changed = true;
        }
    }

    protected modifiers() {
        const { params, recordedMoveBegin, position, fov } = this;
        const { proportionalCameraSpeed } = params;
        let scale = 20;
        if (proportionalCameraSpeed && recordedMoveBegin) {
            scale = vec3.dist(position, recordedMoveBegin) * Math.tan(((Math.PI / 180) * fov) / 2) * 2;
            const mouseWheelModifier = this.input.hasShift ? 0 : clamp(scale / 3, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const mousePanModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const touchMovementModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const pinchModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            return {
                mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale: 20
            }
        }
        return {
            mouseWheelModifier: this.input.hasShift ? 0 : scale, mousePanModifier: scale, touchMovementModifier: scale, pinchModifier: scale, scale
        }
    }

    protected getTransformations(): CameraTransformations {
        const { axes } = this;
        const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_lmb_move_x + axes.touch_1_move_x;
        const pivotX = -axes.mouse_rmb_move_y + -axes.touch_3_move_y;
        const pivotY = -axes.mouse_rmb_move_x + -axes.touch_3_move_x;
        const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);

        const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale } = this.modifiers();
        const tx = (axes.keyboard_ad * scale) - (axes.mouse_mmb_move_x * mousePanModifier) - (axes.touch_2_move_x * touchMovementModifier);
        const ty = (axes.keyboard_qe * scale) - (axes.mouse_mmb_move_y * mousePanModifier) - (axes.touch_2_move_y * touchMovementModifier);
        const tz = (axes.keyboard_ws * scale) + (axes.mouse_wheel * mouseWheelModifier) + (axes.touch_pinch2 * pinchModifier);
        const rx = shouldPivot ? pivotX : rotX;
        const ry = shouldPivot ? pivotY : rotY;
        return { tx, ty, tz, rx, ry, shouldPivot };
    }

    override update(): void {
        const { multiplier, orientation, params, height, pivot, zoomPos, currentFlyTo } = this;
        if (currentFlyTo) {
            this.position = vec3.clone(currentFlyTo.pos);
            orientation.pitch = currentFlyTo.pitch;
            orientation.yaw = currentFlyTo.yaw;
            this.changed = true;
            return;
        }
        this.lastUpdate = performance.now();
        let { tx, ty, tz, rx, ry, shouldPivot } = this.getTransformations();
        if (!this.mouseOrTouchMoving) {
            this.mouseOrTouchMoving = tx > 0.1 || ty > 0.1 || rx > 0.1 || ry > 0.1;
        }
        orientation.roll = 0;
        const [zoomX, zoomY] = zoomPos;

        if (rx || ry) {
            const rotationalVelocity = (shouldPivot ? 180 : this.fov) * params.rotationalVelocity / height;
            orientation.pitch += rx * rotationalVelocity;
            orientation.yaw += ry * rotationalVelocity;
            if (pivot && shouldPivot && pivot.active) {
                const { center, offset, distance } = pivot;
                const pos = vec3.fromValues(0, 0, distance);
                vec3.add(pos, pos, offset);
                vec3.transformQuat(pos, pos, orientation.rotation);
                this.position = vec3.add(vec3.create(), center, pos);
            }
            this.changed = true;
        }

        if (tx || ty || tz) {
            if (tz != 0) {
                tx += zoomX * tz * 0.6;
                ty += -zoomY * tz * 0.6;
            }
            const linearVelocity = multiplier * params.linearVelocity / height;
            const worldPosDelta = vec3.transformQuat(vec3.create(), vec3.fromValues(tx * linearVelocity, -ty * linearVelocity, tz * linearVelocity), orientation.rotation);
            this.position = vec3.add(vec3.create(), this.position, worldPosDelta);
            if (pivot && pivot.active) {
                this.setPivot(pivot.center, pivot.active);
            }
            this.changed = true;
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const changes: MutableCameraState = {};
        const { position, orientation, pivot, fov } = this;
        if (!state || !vec3.exactEquals(state.position, position)) {
            changes.position = position;
        }
        if (!state || !quat.exactEquals(state.rotation, orientation.rotation)) {
            changes.rotation = orientation.rotation;
        }
        if (!state || (pivot && state.pivot && vec3.exactEquals(state.pivot, pivot?.center))) {
            changes.pivot = pivot?.center;
        }
        if (!state || state.fov !== fov) {
            changes.fov = fov;
        }
        if (!state) {
            changes.kind = "pinhole";
        }
        return changes;
    }

    override async mouseButtonChanged(event: MouseEvent): Promise<void> {
        const { pickInterface, pivotButton } = this;
        if (pickInterface) {
            const changes = event.buttons;
            if (changes & pivotButton) {
                const sample = await pickInterface.pick(event.offsetX, event.offsetY);
                if (sample) {
                    this.setPivot(sample.position, true);
                } else {
                    this.resetPivot(true);
                }
            } else {
                this.resetPivot(false);
            }
        }
    }

    override async touchChanged(event: TouchEvent): Promise<void> {
        const { pointerTable, pickInterface, pivotFingers } = this;
        if (pointerTable.length == pivotFingers && pickInterface) {
            const x = pointerTable.length > 1 ? Math.round((pointerTable[0].x + pointerTable[1].x) / 2) : pointerTable[0].x;
            const y = pointerTable.length > 1 ? Math.round((pointerTable[0].y + pointerTable[1].y) / 2) : pointerTable[0].y;
            const sample = await pickInterface.pick(x, y);
            if (sample) {
                this.setPivot(sample.position, true);
            } else {
                this.resetPivot(true);
            }
        } else {
            this.resetPivot(false);
        }
    }

    get moving() {
        return this.input.isAnyGestureKeyPressed() || this.input.isScrolling() || this.mouseOrTouchMoving;
    }

    async moveEnd(event: TouchEvent | MouseEvent): Promise<void> {
        this.mouseOrTouchMoving = false;
    }

    async moveBegin(event: TouchEvent | MouseEvent): Promise<void> {
        const { pointerTable, pickInterface, resetPickDelay } = this;

        const deltaTime = this.lastUpdate - this.lastUpdatedMoveBegin;

        if (pickInterface == undefined || deltaTime < this.params.pickDelay || this.inMoveBegin) {
            return;
        }
        this.inMoveBegin = true;
        const setPickPosition = async (x: number, y: number) => {
            const sample = await pickInterface.pick(x, y, { async: false });
            if (sample) {
                this.recordedMoveBegin = sample.position;
                this.lastUpdatedMoveBegin = performance.now();
            } else if (resetPickDelay < deltaTime) {
                this.recordedMoveBegin = undefined;
                this.lastUpdatedMoveBegin = performance.now();
            }
        }

        if (isTouchEvent(event)) {
            if (pointerTable.length > 1) {
                await setPickPosition(Math.round((pointerTable[0].x + pointerTable[1].x) / 2), Math.round((pointerTable[0].y + pointerTable[1].y) / 2))
            }
        } else {
            await setPickPosition(event.offsetX, event.offsetY)
        }
        this.inMoveBegin = false;

    }

    private resetPivot(active: boolean) {
        const { pivot } = this;
        if (pivot) {
            this.setPivot(pivot.center, active);
        }
    }

    private setPivot(center: ReadonlyVec3, active: boolean) {
        const { position, orientation } = this;
        const distance = vec3.distance(center, position);
        const offset = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(offset, offset, orientation.rotation);
        vec3.add(offset, center, offset);
        vec3.sub(offset, position, offset);
        const invRot = quat.invert(quat.create(), orientation.rotation);
        vec3.transformQuat(offset, offset, invRot)
        this.pivot = { center, offset, distance, active };
    }
}

function isTouchEvent(event: MouseEvent | TouchEvent): event is TouchEvent {
    return "TouchEvent" in globalThis && event instanceof TouchEvent;
}

export class CadMiddlePanController extends FlightController {
    override kind = "cadMiddlePan" as const;

    constructor(readonly pickInterface: PickInterface, input: ControllerInput, params?: FlightControllerParams) {
        super(pickInterface, input);
        this.pivotButton = MouseButtons.left;
        this.pivotFingers = 1;
    }

    override getTransformations(): CameraTransformations {
        const { axes } = this;
        const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_rmb_move_y + axes.touch_3_move_y;
        const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_rmb_move_x + axes.touch_3_move_x;
        const pivotX = -axes.mouse_lmb_move_y + -axes.touch_1_move_y;
        const pivotY = -axes.mouse_lmb_move_x + -axes.touch_1_move_x;
        const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);

        const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale } = this.modifiers();
        const tx = (axes.keyboard_ad * scale) - (axes.mouse_mmb_move_x * mousePanModifier) - (axes.touch_2_move_x * touchMovementModifier);
        const ty = (axes.keyboard_qe * scale) - (axes.mouse_mmb_move_y * mousePanModifier) - (axes.touch_2_move_y * touchMovementModifier);
        const tz = (axes.keyboard_ws * scale) + (axes.mouse_wheel * mouseWheelModifier) + (axes.touch_pinch2 * pinchModifier);
        const rx = shouldPivot ? pivotX : rotX;
        const ry = shouldPivot ? pivotY : rotY;

        return { tx, ty, tz, rx, ry, shouldPivot };
    }
}

export class CadRightPanController extends FlightController {
    override kind = "cadRightPan" as const;

    constructor(readonly pickInterface: PickInterface, input: ControllerInput, params?: FlightControllerParams) {
        super(pickInterface, input);
        this.pivotButton = MouseButtons.left;
        this.pivotFingers = 1;
    }

    override getTransformations(): CameraTransformations {
        const { axes } = this;
        const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_mmb_move_y + axes.touch_3_move_y;
        const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_mmb_move_x + axes.touch_3_move_x;
        const pivotX = -axes.mouse_lmb_move_y + -axes.touch_1_move_y;
        const pivotY = -axes.mouse_lmb_move_x + -axes.touch_1_move_x;
        const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);

        const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale } = this.modifiers();
        const tx = (axes.keyboard_ad * scale) - (axes.mouse_rmb_move_x * mousePanModifier) - (axes.touch_2_move_x * touchMovementModifier);
        const ty = (axes.keyboard_qe * scale) - (axes.mouse_rmb_move_y * mousePanModifier) - (axes.touch_2_move_y * touchMovementModifier);
        const tz = (axes.keyboard_ws * scale) + (axes.mouse_wheel * mouseWheelModifier) + (axes.touch_pinch2 * pinchModifier);
        const rx = shouldPivot ? pivotX : rotX;
        const ry = shouldPivot ? pivotY : rotY;

        return { tx, ty, tz, rx, ry, shouldPivot };
    }
}

export class SpecialFlightController extends FlightController {
    override kind = "special" as const;

    constructor(readonly pickInterface: PickInterface, input: ControllerInput, params?: FlightControllerParams) {
        super(pickInterface, input);
        this.pivotButton = MouseButtons.middle;
        this.pivotFingers = 1;
    }

    override getTransformations(): CameraTransformations {
        const { axes } = this;
        const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_rmb_move_y + axes.touch_3_move_y;
        const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_rmb_move_x + axes.touch_3_move_x;
        const pivotX = -axes.mouse_mmb_move_y + -axes.touch_1_move_y;
        const pivotY = -axes.mouse_mmb_move_x + -axes.touch_1_move_x;
        const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);

        const { mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale } = this.modifiers();
        const tx = (axes.keyboard_ad * scale) - (axes.mouse_lmb_move_x * mousePanModifier) - (axes.touch_2_move_x * touchMovementModifier);
        const ty = (axes.keyboard_qe * scale) - (axes.mouse_lmb_move_y * mousePanModifier) - (axes.touch_2_move_y * touchMovementModifier);
        const tz = (axes.keyboard_ws * scale) + (axes.mouse_wheel * mouseWheelModifier) + (axes.touch_pinch2 * pinchModifier);
        const rx = shouldPivot ? pivotX : rotX;
        const ry = shouldPivot ? pivotY : rotY;

        return { tx, ty, tz, rx, ry, shouldPivot };
    }
}