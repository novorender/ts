
import { mergeRecursive, type RenderStateCamera } from "core3d";
import { type ReadonlyVec3, glMatrix, vec2, vec3, type ReadonlyQuat } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState } from "./base";
import { PitchRollYawOrientation } from "./orientation";
import { ControllerInput } from "./input";

/** A camera controller for orbiting around a point of interest.
 * @category Camera Controllers
 */
export class OrbitController extends BaseController {
    override kind = "orbit" as const;
    override projection = "pinhole" as const;

    private params: OrbitControllerParams = {
        maxDistance: 1000,
        linearVelocity: 1,
        rotationalVelocity: 1,
    };
    private readonly _orientation = new PitchRollYawOrientation(-30, 30);
    private _pivot: ReadonlyVec3 = vec3.create();
    private _distance = 10;
    private _fov = 60;

    /**
     * @param input The input source.
     * @param params Optional initialization parameters.
     */
    constructor(input: ControllerInput, params?: Partial<OrbitControllerParams>) {
        super(input);
        Object.assign(this.params, params);
    }

    /** The current controller parameters. */
    get parameters() {
        return this.params;
    }

    /** Computed position, in world space.
     * @remarks
     * This position is derived from {@link pivot} point, {@link distance}, rotated around {@link pitch} and {@link yaw} angles.
     */
    get position() {
        const { _orientation, _pivot, _distance } = this;
        const pos = vec3.fromValues(0, 0, _distance);
        vec3.transformQuat(pos, pos, _orientation.rotation);
        vec3.add(pos, pos, _pivot);
        return pos;
    }

    /** Computed rotation quaternion, in world space.
     * @remarks
     * This rotation is derived from {@link pitch} and {@link yaw} angles.
     */
    get rotation() {
        return this._orientation.rotation;
    }

    /** The pitch angle around the pivot point, in degrees. */
    get pitch() {
        return this._orientation.pitch;
    }
    set pitch(value: number) {
        this._orientation.pitch = value;
        this.changed();
    }

    /** The yaw angle around the pivot point, in degrees. */
    get yaw() {
        return this._orientation.yaw;
    }
    set yaw(value: number) {
        this._orientation.yaw = value;
        this.changed();
    }

    /** The pivot point to orbit around, in world space. */
    get pivot() {
        return this._pivot;
    }
    set pivot(value: ReadonlyVec3) {
        this._pivot = value;
        this.changed();
    }

    /** The distance from the pivot point, in meters. */
    get distance() {
        return this._distance;
    }
    set distance(value: number) {
        this._distance = value;
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
    updateParams(params: Partial<OrbitControllerParams>) {
        this.params = mergeRecursive(this.params, params);
    }

    override serialize(includeDerived = false): ControllerInitParams {
        const { kind, pivot, _orientation, distance, fov } = this;
        const { rotation } = _orientation;
        return { kind, pivot, rotation, distance, fovDegrees: fov, ...(includeDerived ? { position: this.position } : undefined) };
    }

    override init(params: ControllerInitParams) {
        const { kind, position, rotation, pivot, fovDegrees, distance } = params;
        console.assert(kind == this.kind);
        if (fovDegrees != undefined) {
            this._fov = fovDegrees;
        }
        if (pivot) {
            this._pivot = pivot;
        }
        if (rotation) {
            this._orientation.decomposeRotation(rotation);
            this._orientation.roll = 0;
        }
        if (distance) {
            this._distance = distance;
            if (!pivot && position && rotation) {
                const tmp = vec3.fromValues(0, 0, -distance);
                vec3.transformQuat(tmp, tmp, rotation);
                this._pivot = vec3.add(tmp, tmp, position);
            }
        }
        if (position && pivot) {
            const { _orientation } = this;
            if (!distance) {
                this._distance = vec3.distance(position, pivot);
            }
            if (!rotation) {
                const [x, y, z] = vec3.sub(vec3.create(), position, pivot);
                const pitch = Math.atan2(-y, vec2.len(vec2.fromValues(x, z)));
                const yaw = Math.atan2(x, z);
                _orientation.yaw = yaw * 180 / Math.PI;
                _orientation.pitch = pitch * 180 / Math.PI;
                _orientation.roll = 0;
            }
        }
        this.attach();
        this.changed();
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
        const { params } = this;
        this._pivot = center;
        this._distance = Math.min(params.maxDistance, radius / Math.tan(glMatrix.toRadian(this._fov) / 2));
        this.changed();
    }

    override update() {
        const { axes, multiplier, _pivot, _orientation, _distance, _fov, params, height } = this;
        const tx = axes.keyboard_ad + axes.mouse_rmb_move_x - axes.touch_2_move_x;
        const ty = -axes.keyboard_qe + axes.mouse_rmb_move_y - axes.touch_2_move_y;
        const tz = axes.keyboard_ws * 2 + axes.mouse_mmb_move_y + axes.mouse_wheel / 2 + axes.touch_pinch2 * 2;
        const rx = axes.keyboard_arrow_up_down / 5 + axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const ry = axes.keyboard_arrow_left_right / 5 + axes.mouse_lmb_move_x + axes.touch_1_move_x;

        _orientation.roll = 0;
        const rotationalVelocity = 180 * params.rotationalVelocity / height;
        if (rx || ry) {
            _orientation.pitch += -rx * rotationalVelocity;
            _orientation.yaw += -ry * rotationalVelocity;
            this.changed();
        }

        const fovRatio = Math.tan(((Math.PI / 180) * _fov) / 2) * 2;
        const linearVelocity = _distance * fovRatio * multiplier * params.linearVelocity / height;
        if (tz) {
            this._distance += tz * linearVelocity;
            this.changed();
        } else if (tx || ty) {
            const worldPosDelta = vec3.transformQuat(vec3.create(), vec3.fromValues(tx * linearVelocity, -ty * linearVelocity, 0), _orientation.rotation);
            this._pivot = vec3.add(vec3.create(), _pivot, worldPosDelta);
            this.changed();
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const { _pivot, _orientation, position, _fov } = this;
        const changes: MutableCameraState = {};
        if (!state || !vec3.exactEquals(state.position, position)) {
            changes.position = position;
        }
        if (!state || state.rotation !== _orientation.rotation) {
            changes.rotation = _orientation.rotation;
        }
        if (!state || state.pivot !== _pivot) {
            changes.pivot = _pivot;
        }
        if (!state || state.fov !== _fov) {
            changes.fov = _fov;
        }
        if (!state) {
            changes.kind = "pinhole";
        }
        return changes;
    }

    /** OrbitController type guard function.
     * @param controller The controller to type guard.
     */
    static is(controller: BaseController): controller is OrbitController {
        return controller instanceof OrbitController;
    }

    /** OrbitController type assert function.
     * @param controller The controller to type assert.
     */
    static assert(controller: BaseController): asserts controller is OrbitController {
        if (!(controller instanceof OrbitController))
            throw new Error("Camera controller is not of type OrbitController!");
    }
}


/** Orbit type camera motion controller
 * @category Camera Controllers
 */
export interface OrbitControllerParams {
    /** The camera distance relative to pivot point in meters. */
    readonly maxDistance: number;

    /** Linear velocity modifier (default is 1.0) */
    readonly linearVelocity: number;

    /** Rotational velocity modifier (default is 1.0) */
    readonly rotationalVelocity: number;
}

