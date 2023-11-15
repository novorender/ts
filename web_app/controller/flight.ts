
import { type ReadonlyVec3, vec3, quat, glMatrix, type ReadonlyQuat } from "gl-matrix";
import { BaseController, easeInOut, type ControllerInitParams, type MutableCameraState, type PickContext } from "./base";
import { type RenderStateCamera, type RecursivePartial, mergeRecursive, type BoundingSphere } from "core3d";
import { PitchRollYawOrientation, clamp, decomposeRotation } from "./orientation";
import { ControllerInput, MouseButtons } from "./input";

/** The flight controller mimics the behaviour of an etheral, hovering drone, allowing unconstrained movements through walls and obstacles.
 * @category Camera Controllers
 */
export class FlightController extends BaseController {
    /** @internal */
    protected arrowKeyScale = 1.0;
    /** @internal */
    protected pivotButton: MouseButtons = MouseButtons.right;
    /** @internal */
    protected pivotFingers: number = 3;

    override kind = "flight";
    override projection = "pinhole" as const;

    private params: FlightControllerParams = {
        linearVelocity: 1,
        rotationalVelocity: 1,
        pickDelay: 200,
        proportionalCameraSpeed: null, // { min: 0.2, max: 1000 }
        enableShiftModifierOnWheel: false
    }

    private _position: ReadonlyVec3 = vec3.create();
    private readonly _orientation = new PitchRollYawOrientation(-30, 30);
    private _pivot: Pivot | undefined;
    private _fov = 60;

    private readonly resetPickDelay = 3000;
    private lastUpdatedMoveBegin: number = 0;
    private lastUpdate: number = 0;
    private moveBeginDelay = 0;
    private recordedMoveBegin: ReadonlyVec3 | undefined = undefined;
    private inMoveBegin = false;

    /**
     * @param input The input source.
     * @param pick The context used for pick queries.
     */
    constructor(
        input: ControllerInput,
        /** The context used for pick queries. */
        readonly pick: PickContext,
    ) {
        super(input);
    }

    /** Camera position, in world space. */
    get position() {
        return this._position;
    }
    set position(value: ReadonlyVec3) {
        this._position = value;
        this.changed();
    }

    /** Computed rotation quaternion, in world space.
     * @remarks
     * This rotation is derived from {@link pitch} and {@link yaw} angles.
     */
    get rotation() {
        return this._orientation.rotation;
    }

    /** The camera pitch angle, in degrees. */
    get pitch() {
        return this._orientation.pitch;
    }
    set pitch(value: number) {
        this._orientation.pitch = value;
        this.changed();
    }

    /** The camera yaw angle, in degrees. */
    get yaw() {
        return this._orientation.yaw;
    }
    set yaw(value: number) {
        this._orientation.yaw = value;
        this.changed();
    }

    /** The camera vertical field of view angle, in degrees. */
    get fov() {
        return this._fov;
    }
    set fov(value: number) {
        this._fov = value;
        this.changed();
    }

    /** The optional pivot point to orbit around, in world space. */
    get pivot() {
        return this._pivot;
    }

    /** Update controller parameters.
     * @param params Set of parameters to change.
     */
    updateParams(params: RecursivePartial<FlightControllerParams>) {
        this.params = mergeRecursive(this.params, params);
    }

    override serialize(): ControllerInitParams {
        const { kind, position, _orientation, _fov } = this;
        const { rotation } = _orientation;
        return { kind, position, rotation, fovDegrees: _fov };
    }

    override init(params: ControllerInitParams) {
        const { kind, position, rotation, fovDegrees } = params;
        console.assert(kind == this.kind);
        if (position) {
            this._position = position;
        }
        if (rotation) {
            this._orientation.decomposeRotation(rotation);
            this._orientation.roll = 0;
        }
        if (fovDegrees != undefined) {
            this._fov = fovDegrees;
        }
        this.input.callbacks = this;
        this.input.usePointerLock = true;
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
        const { _orientation } = this;
        const maxDistance = 1000;
        const distance = Math.min(maxDistance, radius / Math.tan(glMatrix.toRadian(this._fov) / 2));
        const dir = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(dir, dir, _orientation.rotation);
        this._position = vec3.add(vec3.create(), center, dir)
    }

    override moveTo(targetPosition: ReadonlyVec3, flyTime: number = 1000, rotation?: ReadonlyQuat): void {
        const { _orientation, _position } = this;
        if (flyTime) {
            let targetPitch = _orientation.pitch;
            let targetYaw = _orientation.yaw;
            if (rotation) {
                const { pitch, yaw } = decomposeRotation(rotation)
                targetPitch = pitch / Math.PI * 180;
                targetYaw = yaw / Math.PI * 180;
            }

            this.setFlyTo({
                totalFlightTime: flyTime,
                end: { pos: vec3.clone(targetPosition), pitch: targetPitch, yaw: targetYaw },
                begin: { pos: vec3.clone(_position), pitch: _orientation.pitch, yaw: _orientation.yaw },
                easeFunction: easeInOut
            });
        }
        else {
            this._position = targetPosition;
            if (rotation) {
                this._orientation.decomposeRotation(rotation);
            }
            this.changed();
        }
    }

    override zoomTo(boundingSphere: BoundingSphere, flyTime: number = 1000): void {
        const { _orientation, _position, _fov } = this;
        if (flyTime) {
            const dist = Math.max(boundingSphere.radius / Math.tan(glMatrix.toRadian(_fov) / 2), boundingSphere.radius);
            const targetPosition = vec3.create();
            vec3.add(targetPosition, vec3.transformQuat(targetPosition, vec3.fromValues(0, 0, dist), _orientation.rotation), boundingSphere.center);
            this.setFlyTo({
                totalFlightTime: flyTime,
                end: { pos: vec3.clone(targetPosition), pitch: _orientation.pitch, yaw: _orientation.yaw + 0.05 },
                begin: { pos: vec3.clone(_position), pitch: _orientation.pitch, yaw: _orientation.yaw },
                easeFunction: easeInOut
            });
        } else {
            const dist = boundingSphere.radius / Math.tan(glMatrix.toRadian(_fov) / 2);
            this._position = vec3.add(vec3.create(), vec3.transformQuat(vec3.create(), vec3.fromValues(0, 0, dist), _orientation.rotation), boundingSphere.center);
            this.changed();
        }
    }

    override update(): void {
        const { multiplier, _orientation, params, height, _pivot, zoomPos, currentFlyTo } = this;
        if (currentFlyTo) {
            this._position = vec3.clone(currentFlyTo.pos);
            _orientation.pitch = currentFlyTo.pitch;
            _orientation.yaw = currentFlyTo.yaw;
            this.changed();
            return;
        }
        this.lastUpdate = performance.now();
        let { tx, ty, tz, rx, ry, shouldPivot } = this.getTransformations();
        _orientation.roll = 0;
        const [zoomX, zoomY] = zoomPos;

        if (rx || ry) {
            const rotationalVelocity = (shouldPivot ? 180 : this._fov) * params.rotationalVelocity / height;
            _orientation.pitch += rx * rotationalVelocity;
            _orientation.yaw += ry * rotationalVelocity;
            if (_pivot && shouldPivot && _pivot.active) {
                const { center, offset, distance } = _pivot;
                const pos = vec3.fromValues(0, 0, distance);
                vec3.add(pos, pos, offset);
                vec3.transformQuat(pos, pos, _orientation.rotation);
                this._position = vec3.add(vec3.create(), center, pos);
            }
            this.changed();
        }

        if (tx || ty || tz) {
            if (tz != 0) {
                tx += zoomX * tz * 0.6;
                ty += -zoomY * tz * 0.6;
            }
            const linearVelocity = multiplier * params.linearVelocity / height;
            const worldPosDelta = vec3.transformQuat(vec3.create(), vec3.fromValues(tx * linearVelocity, -ty * linearVelocity, tz * linearVelocity), _orientation.rotation);
            this._position = vec3.add(vec3.create(), this._position, worldPosDelta);
            if (_pivot && _pivot.active) {
                this.setPivot(_pivot.center, _pivot.active);
            }
            this.changed();
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const changes: MutableCameraState = {};
        const { _position, _orientation, _pivot, _fov } = this;
        if (!state || !vec3.exactEquals(state.position, _position)) {
            changes.position = _position;
        }
        if (!state || !quat.exactEquals(state.rotation, _orientation.rotation)) {
            changes.rotation = _orientation.rotation;
        }
        if (!state || (_pivot && state.pivot && vec3.exactEquals(state.pivot, _pivot?.center))) {
            changes.pivot = _pivot?.center;
        }
        if (!state || state.fov !== _fov) {
            changes.fov = _fov;
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
        const setPickPosition = async (x: number, y: number, touchEvent: boolean) => {
            const sample = await pick.pick(x, y, { async: true, sampleDiscRadius: touchEvent ? 8 : 4 });
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
                await setPickPosition(Math.round((pointerTable[0].x + pointerTable[1].x) / 2), Math.round((pointerTable[0].y + pointerTable[1].y) / 2), true)
            }
        } else {
            await setPickPosition(event.offsetX, event.offsetY, false)
        }
        this.inMoveBegin = false;

    }

    private resetPivot(active: boolean) {
        const { _pivot } = this;
        if (_pivot) {
            this.setPivot(_pivot.center, active);
        }
    }

    private setPivot(center: ReadonlyVec3, active: boolean) {
        const { _position, _orientation } = this;
        const distance = vec3.distance(center, _position);
        const offset = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(offset, offset, _orientation.rotation);
        vec3.add(offset, center, offset);
        vec3.sub(offset, _position, offset);
        const invRot = quat.invert(quat.create(), _orientation.rotation);
        vec3.transformQuat(offset, offset, invRot)
        this._pivot = { center, offset, distance, active };
    }

    /** @internal */
    protected modifiers() {
        const { params, recordedMoveBegin, _position, _fov } = this;
        const { proportionalCameraSpeed, enableShiftModifierOnWheel } = params;
        let scale = 20;
        if (proportionalCameraSpeed && recordedMoveBegin) {
            scale = vec3.dist(_position, recordedMoveBegin) * Math.tan(((Math.PI / 180) * _fov) / 2) * 2;
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

    /** FlightController type guard function.
     * @param controller The controller to type guard.
     */
    static is(controller: BaseController): controller is FlightController {
        return controller instanceof FlightController;
    }

    /** FlightController type assert function.
     * @param controller The controller to type assert.
     */
    static assert(controller: BaseController): asserts controller is FlightController {
        if (!(controller instanceof FlightController))
            throw new Error("Camera controller is not of type FlightController!");
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

    constructor(input: ControllerInput, readonly pick: PickContext, params?: FlightControllerParams) {
        super(input, pick);
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

    constructor(input: ControllerInput, readonly pick: PickContext, params?: FlightControllerParams) {
        super(input, pick);
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

    constructor(input: ControllerInput, readonly pick: PickContext, params?: FlightControllerParams) {
        super(input, pick);
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
    /** The camera linear velocity factor.
     * @defaultValue 1
     */
    linearVelocity: number;

    /** The camera rotational velocity factor.
     * @defaultValue 1
     */
    rotationalVelocity: number;

    /** Delay for pick updates, in milliseconds.
     * @defaultValue 200
     */
    pickDelay: number;

    /** Option to enable shift to modify mouse wheel speed.
    * @defaultValue false
    */
    enableShiftModifierOnWheel: boolean;

    /** 
     * When set, the controller will sample the distance to the pixel under the mouse cursor,
     * or central pinch point, and move the camera with speed proportional to that distance.
     * The min and max determines the bounds of how slow/fast it is allowed to move.
     * 
     * Setting this to `null` disables this feature, using a constant speed factor of 1.0.
     * @defaultValue null
     */
    proportionalCameraSpeed: { readonly min: number, readonly max: number; } | null;
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
