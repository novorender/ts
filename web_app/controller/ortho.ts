
import { type ReadonlyVec3, vec3, type ReadonlyQuat, glMatrix, vec2 } from "gl-matrix";
import { BaseController, easeInOut, type ControllerInitParams, type MutableCameraState, easeOut } from "./base";
import { mergeRecursive, type BoundingSphere, type RenderStateCamera } from "core3d";
import { PitchRollYawOrientation, decomposeRotation } from "./orientation";
import { ControllerInput } from "./input";

/** The ortho controller is for navigating a orthographic camera.
 * @remarks
 * A key aspect of this controller is as a means to view and navigate in 2D,
 * aligning the parallel to the view plane to the axes or some reference plane.
 * The front and back clipping planes are used to reveal a limited slab of the geometry.
 * @category Camera Controllers
 */
export class OrthoController extends BaseController {
    override kind = "ortho" as const;
    override projection = "orthographic" as const;

    private params: OrthoControllerParams = {
        stepInterval: 1,
        usePointerLock: false,
        touchRotate: false,
        touchDeAcceleration: false
    };
    private _position: ReadonlyVec3 = vec3.create();
    private _orientation = new PitchRollYawOrientation();
    private _fov = 50;
    private _touchVelocity = vec2.create();

    /**
     * @param input The input source.
     */
    constructor(input: ControllerInput) {
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
     * This rotation is derived from {@link pitch}, {@link yaw} and  {@link roll} angles.
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

    /** The camera roll angle, in degrees. */
    get roll() {
        return this._orientation.roll;
    }
    set roll(value: number) {
        this._orientation.roll = value;
        this.changed();
    }

    /** The camera vertical field of view angle, in meters. */
    get fov() {
        return this._fov;
    }
    set fov(value: number) {
        this._fov = value;
        this.changed();
    }

    /** Update controller parameters.
     * @param params Set of parameters to change.
     */
    updateParams(params: Partial<OrthoControllerParams>) {
        this.params = mergeRecursive(this.params, params);
        if (this.input.callbacks == this) {
            this.input.usePointerLock = this.params.usePointerLock;
        }
    }

    override serialize(): ControllerInitParams {
        const { kind, position, _orientation, _fov } = this;
        const { rotation } = _orientation;
        return { kind, position, rotation, fovMeters: _fov };
    }

    override init(params: ControllerInitParams) {
        const { kind, position, rotation, fovMeters, distance, fovDegrees } = params;
        console.assert(kind == this.kind);
        if (position) {
            this._position = position;
        }
        if (rotation) {
            this._orientation.decomposeRotation(rotation);
        }
        if (fovMeters) {
            this._fov = fovMeters;
        } else if (fovDegrees && distance) {
            this._fov = OrthoController.fovFromPerspective(fovDegrees, distance);
        }
        this.changed();
        this.input.usePointerLock = this.params.usePointerLock;
        this.input.callbacks = this;
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
        const { _orientation } = this;
        const dir = vec3.fromValues(0, 0, radius);
        vec3.transformQuat(dir, dir, _orientation.rotation);
        this._position = vec3.add(vec3.create(), center, dir);
        this._orientation.pitch = -90;
        this._orientation.yaw = 0;
        this._orientation.roll = 0;
        this._fov = radius * 2;
        this.changed();
    }

    override touchChanged(event: TouchEvent): void {
        if (this.params.touchDeAcceleration) {
            const { _touchVelocity, height, _position, _orientation } = this;
            if (event.touches.length == 0 && _touchVelocity[0] != 0 && _touchVelocity[1] != 0) {
                const scale = this._fov / height;
                const deltaPos = vec3.transformQuat(vec3.create(), vec3.fromValues(_touchVelocity[0] * scale * -1, _touchVelocity[1] * scale, 0), _orientation.rotation);
                vec3.scale(deltaPos, deltaPos, 10);
                this.moveTo(vec3.add(vec3.create(), _position, deltaPos), 500, undefined, easeOut);
                this._touchVelocity = vec2.create();
            }
        }
    }

    override moveTo(targetPosition: ReadonlyVec3, flyTime: number = 1000, rotation?: ReadonlyQuat, easeFunction?: (t: number) => number): void {
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
                easeFunction: easeFunction ? easeFunction : easeInOut
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

    override update() {
        const { axes, zoomPos, height, _position, _orientation, hasShift, currentFlyTo } = this;
        if (currentFlyTo) {
            this._position = vec3.clone(currentFlyTo.pos);
            _orientation.pitch = currentFlyTo.pitch;
            _orientation.yaw = currentFlyTo.yaw;
            this.changed();
            return;
        }

        this._touchVelocity = vec2.fromValues(axes.touch_1_move_x, axes.touch_1_move_y);

        let tx = -axes.keyboard_ad + axes.mouse_lmb_move_x + axes.mouse_rmb_move_x + axes.mouse_mmb_move_x + axes.touch_1_move_x;
        let ty = -axes.keyboard_ws + axes.mouse_lmb_move_y + axes.mouse_rmb_move_y + axes.mouse_mmb_move_y + axes.touch_1_move_y;
        const tz = (axes.touch_pinch3 * 0.1) + (hasShift ? axes.mouse_wheel * 0.01 : 0);
        //Assume that very low rotate over the course of a frame is unintentional when zooming
        const touchRotate = (this.params.touchRotate && Math.abs(axes.touch_2_rotate) > 0.004 ? (axes.touch_2_rotate * 300) : 0);
        const rz = -axes.keyboard_arrow_left_right / 2 + touchRotate;
        const zoom = (hasShift ? 0 : axes.mouse_wheel) + axes.touch_pinch2 - axes.keyboard_qe;
        const [zoomX, zoomY] = zoomPos;

        if (rz) {
            _orientation.roll += rz * 0.2;
            this.changed();
        }
        if (tx || ty || tz || zoom) {
            if (zoom != 0) {
                const dz = 1 + (zoom / height);
                tx += zoomX * -zoom * 0.6;
                ty += zoomY * zoom * 0.6;
                this._fov *= dz;
            }
            const scale = this._fov / height;
            const deltaPos = vec3.transformQuat(vec3.create(), vec3.fromValues(tx * scale * -1, ty * scale, tz), _orientation.rotation);
            this._position = vec3.add(vec3.create(), _position, deltaPos);
            this.changed();
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const changes: MutableCameraState = {};
        if (!state || state.position !== this._position) {
            changes.position = this._position;
        }
        if (!state || state.rotation !== this._orientation.rotation) {
            changes.rotation = this._orientation.rotation;
        }
        if (!state || state.fov !== this._fov) {
            changes.fov = this._fov;
        }
        if (!state) {
            changes.kind = "orthographic";
        }
        return changes;
    }

    //perspectiveDepth = BaseController.getDistanceFromViewPlane(pivot);
    private static fovFromPerspective(perspectiveFov: number, perspectiveDepth: number) {
        return Math.max(0.1, perspectiveDepth) * Math.tan(((Math.PI / 180) * perspectiveFov) / 2) * 2;
    }

    /** OrthoController type guard function.
     * @param controller The controller to type guard.
     */
    static is(controller: BaseController): controller is OrthoController {
        return controller instanceof OrthoController;
    }

    /** OrthoController type assert function.
     * @param controller The controller to type assert.
     */
    static assert(controller: BaseController): asserts controller is OrthoController {
        if (!(controller instanceof OrthoController))
            throw new Error("Camera controller is not of type OrthoController!");
    }
}

/** Ortho controller initialization parameters.
 * @category Camera Controllers
 */
export interface OrthoControllerParams {
    /** The interval to use for stepping clipping planes in the depth direction, i.e. when using mouse navigate buttons.
     * @defaultValue 1.0
     */
    readonly stepInterval: number;

    /** Whether to use mouse pointer lock or not.
     * @defaultValue false
     */
    readonly usePointerLock: boolean;

    /** Whether two finger rotate will rotate camera or not.
     * @defaultValue false
     */
    readonly touchRotate: boolean;

    /** Enable de acceleration when letting go while moving in touch
     * @defaultValue false
     */
    readonly touchDeAcceleration: boolean
}

