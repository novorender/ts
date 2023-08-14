
import { type ReadonlyVec3, vec3, glMatrix, quat } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState, type PickContext } from "./base";
import { type RenderStateCamera, type RecursivePartial, mergeRecursive, type BoundingSphere } from "core3d";
import { PitchRollYawOrientation, clamp, decomposeRotation } from "./orientation";
import { ControllerInput, MouseButtons } from "./input";

/** The flight controller mimics the behaviour of an etheral, hovering drone, allowing unconstrained movements through walls and obstacles.
 * @category Camera Controllers
 */
export class FlightController extends BaseController {
    private static readonly defaultParams = {
        position: [0, 0, 0],
        pitch: -30,
        yaw: 30,
        linearVelocity: 1,
        rotationalVelocity: 1,
        flightTime: 0,
        fieldOfView: 60,
        pickDelay: 200,
        proportionalCameraSpeed: null, // { min: 0.2, max: 1000 }
        enableShiftModifierOnWheel: false
    };

    /** @internal */
    protected arrowKeyScale = 0.4;
    /** @internal */
    protected pivotButton: MouseButtons = MouseButtons.right;
    /** @internal */
    protected pivotFingers: number = 3;

    override kind = "flight";
    override projection = "pinhole" as const;
    override changed = false;

    private params;
    private position: ReadonlyVec3 = vec3.create();
    private readonly orientation = new PitchRollYawOrientation();
    private pivot: Pivot | undefined;
    private fov: number;

    private readonly resetPickDelay = 3000;
    private lastUpdatedMoveBegin: number = 0;
    private lastUpdate: number = 0;
    private moveBeginDelay = 0;
    private recordedMoveBegin: ReadonlyVec3 | undefined = undefined;
    private inMoveBegin = false;

    /**
     * @param pick The context used for pick queries.
     * @param input The input source.
     * @param params Optional initialization parameters.
     */
    constructor(
        /** The context used for pick queries. */
        readonly pick: PickContext,
        input: ControllerInput, params?: FlightControllerParams) {
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

    override update(): void {
        this.changed = false;
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
        const { pick, pivotButton } = this;
        if (pick) {
            const changes = event.buttons;
            if (changes & pivotButton) {
                const sample = await pick.pick(event.offsetX, event.offsetY);
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
        const { pointerTable, pick, pivotFingers } = this;
        if (pointerTable.length == pivotFingers && pick) {
            const x = pointerTable.length > 1 ? Math.round((pointerTable[0].x + pointerTable[1].x) / 2) : pointerTable[0].x;
            const y = pointerTable.length > 1 ? Math.round((pointerTable[0].y + pointerTable[1].y) / 2) : pointerTable[0].y;
            const sample = await pick.pick(x, y);
            if (sample) {
                this.setPivot(sample.position, true);
            } else {
                this.resetPivot(true);
            }
        } else {
            this.resetPivot(false);
        }
    }

    async moveBegin(event: TouchEvent | MouseEvent): Promise<void> {
        const { pointerTable, pick, resetPickDelay } = this;

        const deltaTime = this.lastUpdate - this.lastUpdatedMoveBegin;
        if (pick == undefined || deltaTime < this.params.pickDelay || this.inMoveBegin) {
            return;
        }
        this.inMoveBegin = true;
        const setPickPosition = async (x: number, y: number) => {
            const sample = await pick.pick(x, y, { async: true });
            if (sample) {
                if (performance.now() - this.lastUpdatedMoveBegin > 2000) { //Delay proportinal speed for better feeling on bad devices
                    this.moveBeginDelay = performance.now();
                }
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

    /** @internal */
    protected modifiers() {
        const { params, recordedMoveBegin, position, fov } = this;
        const { proportionalCameraSpeed, enableShiftModifierOnWheel } = params;
        let scale = 20;
        if (proportionalCameraSpeed && recordedMoveBegin) {
            scale = vec3.dist(position, recordedMoveBegin) * Math.tan(((Math.PI / 180) * fov) / 2) * 2;
            const siceMoveDelay = performance.now() - this.moveBeginDelay;
            if (siceMoveDelay < 400) {  //Delay proportinal speed for better feeling on bad devices
                scale = Math.min(scale, 60 + (siceMoveDelay * 0.5));
            }
            let mouseWheelModifier = this.input.hasShift && !enableShiftModifierOnWheel ? 0 : clamp(scale / 3, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const mousePanModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const touchMovementModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const pinchModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            return {
                mouseWheelModifier, mousePanModifier, touchMovementModifier, pinchModifier, scale: 20
            }
        }
        return {
            mouseWheelModifier: this.input.hasShift && !enableShiftModifierOnWheel ? 0 : scale, mousePanModifier: scale, touchMovementModifier: scale, pinchModifier: scale, scale
        }
    }

    /** @internal */
    protected getTransformations(): CameraTransformations {
        const { axes, arrowKeyScale } = this;
        const rotX = -axes.keyboard_arrow_up_down * arrowKeyScale - axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const rotY = -axes.keyboard_arrow_left_right * arrowKeyScale - axes.mouse_lmb_move_x + axes.touch_1_move_x;
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
}

function isTouchEvent(event: MouseEvent | TouchEvent): event is TouchEvent {
    return "TouchEvent" in globalThis && event instanceof TouchEvent;
}

/** Variant of flight controller that uses middle mouse button for panning.
 * @category Camera Controllers
 */
export class CadMiddlePanController extends FlightController {
    override kind = "cadMiddlePan" as const;

    constructor(readonly pick: PickContext, input: ControllerInput, params?: FlightControllerParams) {
        super(pick, input);
        this.pivotButton = MouseButtons.left;
        this.pivotFingers = 1;
    }

    override getTransformations(): CameraTransformations {
        const { axes, arrowKeyScale } = this;
        const rotX = -axes.keyboard_arrow_up_down * arrowKeyScale - axes.mouse_rmb_move_y + axes.touch_3_move_y;
        const rotY = -axes.keyboard_arrow_left_right * arrowKeyScale - axes.mouse_rmb_move_x + axes.touch_3_move_x;
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

/** Variant of flight controller that uses right mouse button for panning.
 * @category Camera Controllers
 */
export class CadRightPanController extends FlightController {
    override kind = "cadRightPan" as const;

    constructor(readonly pick: PickContext, input: ControllerInput, params?: FlightControllerParams) {
        super(pick, input);
        this.pivotButton = MouseButtons.left;
        this.pivotFingers = 1;
    }

    override getTransformations(): CameraTransformations {
        const { axes, arrowKeyScale } = this;
        const rotX = -axes.keyboard_arrow_up_down * arrowKeyScale - axes.mouse_mmb_move_y + axes.touch_3_move_y;
        const rotY = -axes.keyboard_arrow_left_right * arrowKeyScale - axes.mouse_mmb_move_x + axes.touch_3_move_x;
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

/** Vassbakk's super special flight controller.
 * @category Camera Controllers
 */
export class SpecialFlightController extends FlightController {
    override kind = "special" as const;

    /**
     * @param pick 
     * @param input 
     * @param params 
     */
    constructor(readonly pick: PickContext, input: ControllerInput, params?: FlightControllerParams) {
        super(pick, input);
        this.pivotButton = MouseButtons.middle;
        this.pivotFingers = 1;
    }

    override getTransformations(): CameraTransformations {
        const { axes, arrowKeyScale } = this;
        const rotX = -axes.keyboard_arrow_up_down * arrowKeyScale - axes.mouse_rmb_move_y + axes.touch_3_move_y;
        const rotY = -axes.keyboard_arrow_left_right * arrowKeyScale - axes.mouse_rmb_move_x + axes.touch_3_move_x;
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

/** Flight controller initialization parameters
 * @category Camera Controllers
 */
export interface FlightControllerParams {
    /** The camera position.
     * @defaultValue [0,0,0]
     */
    position?: ReadonlyVec3;
    /** The camera pitch.
     * @defaultValue -30
     */
    pitch?: number;

    /** The camera yaw.
     * @defaultValue 30
     */
    yaw?: number;

    /** The camera linear velocity factor.
     * @defaultValue 1
     */
    linearVelocity?: number;

    /** The camera rotational velocity factor.
     * @defaultValue 1
     */
    rotationalVelocity?: number;

    /** Default fly time in milliseconds.
     * @defaultValue 0
     */
    flightTime?: number;

    /** Field of view angle between top and bottom plane, in degrees.
     * @defaultValue 60
     */
    fieldOfView?: number;

    /** Delay for pick updates, in milliseconds.
     * @defaultValue 200
     */
    pickDelay: number;

    /** 
     * When set, the controller will sample the distance to the pixel under the mouse cursor,
     * or central pinch point, and move the camera with speed proportional to that distance.
     * The min and max determines the bounds of how slow/fast it is allowed to move.
     * 
     * Setting this to `null` disables this feature, using a constant speed factor of 1.0.
     * @defaultValue null
     */
    proportionalCameraSpeed?: { readonly min: number, readonly max: number; } | null;
}

interface CameraTransformations {
    tx: number,
    ty: number,
    tz: number,
    rx: number,
    ry: number,
    shouldPivot: boolean
}

interface Pivot {
    center: ReadonlyVec3;
    offset: ReadonlyVec3;
    distance: number;
    active: boolean;
}
