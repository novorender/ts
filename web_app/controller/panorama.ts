
import { type ReadonlyVec3, vec3, type ReadonlyQuat, glMatrix } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState } from "./base";
import { type RenderStateCamera, mergeRecursive } from "core3d";
import { PitchRollYawOrientation, decomposeRotation } from "./orientation";
import { ControllerInput } from "./input";

/** Panorama type camera motion controller
 * @remarks
 * For rotating the camera inside a sphere with a panorama image projected onto it.
 * @category Camera Controllers
 */
export class PanoramaController extends BaseController {
    override kind = "panorama" as const;
    override projection = "pinhole" as const;
    private params: PanoramaControllerParams = {
        rotationalVelocity: 1,
    }
    private _position: ReadonlyVec3 = vec3.create();
    private readonly _orientation = new PitchRollYawOrientation(-30, 30);
    private _fov = 60;

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

    /** Update controller parameters.
     * @param params Set of parameters to change.
     */
    updateParams(params: Partial<PanoramaControllerParams>) {
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
        this.attach();
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
                begin: { pos: vec3.clone(_position), pitch: _orientation.pitch, yaw: _orientation.yaw }
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

    override update(): void {
        const { axes, _orientation, params, height, _fov, currentFlyTo } = this;
        if (currentFlyTo) {
            this._position = vec3.clone(currentFlyTo.pos);
            _orientation.pitch = currentFlyTo.pitch;
            _orientation.yaw = currentFlyTo.yaw;
            this.changed();
            return;
        }
        const tz = axes.keyboard_ws + axes.mouse_wheel + axes.touch_pinch2;
        const rx = -axes.keyboard_arrow_up_down / 5 - axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const ry = -axes.keyboard_arrow_left_right / 5 - axes.mouse_lmb_move_x + axes.touch_1_move_x;
        _orientation.roll = 0;

        if (rx || ry) {
            const rotationalVelocity = this._fov * params.rotationalVelocity / height;
            _orientation.pitch += rx * rotationalVelocity;
            _orientation.yaw += ry * rotationalVelocity;
            this.changed();
        }

        if (tz) {
            const dz = 1 + (tz / height);
            this._fov = Math.max(Math.min(60, _fov * dz), 0.1);
            this.changed();
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const changes: MutableCameraState = {};
        const { _position, _orientation, _fov } = this;
        if (!state || state.position !== _position) {
            changes.position = _position;
        }
        if (!state || state.rotation !== _orientation.rotation) {
            changes.rotation = _orientation.rotation;
        }
        if (!state || state.fov !== _fov) {
            changes.fov = _fov;
        }
        if (!state) {
            changes.kind = "pinhole";
        }
        return changes;
    }

    /** PanoramaController type guard function.
     * @param controller The controller to type guard.
     */
    static is(controller: BaseController): controller is PanoramaController {
        return controller instanceof PanoramaController;
    }

    /** PanoramaController type assert function.
     * @param controller The controller to type assert.
     */
    static assert(controller: BaseController): asserts controller is PanoramaController {
        if (!(controller instanceof PanoramaController))
            throw new Error("Camera controller is not of type PanoramaController!");
    }
}

/** Panorama camera controller parameters
 * @category Camera Controllers
 */
export interface PanoramaControllerParams {
    /** The camera rotational velocity factor.
     * @defaultValue 1
     */
    rotationalVelocity: number;
}

