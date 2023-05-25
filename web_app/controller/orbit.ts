
import { mergeRecursive, type RecursivePartial, type RenderStateCamera } from "core3d";
import { type ReadonlyVec3, glMatrix, vec2, vec3 } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState } from "./base";
import { PitchRollYawOrientation } from "./orientation";
import { ControllerInput } from "./input";

/** Orbit type camera motion controller */
export interface OrbitControllerParams {
    /** The world space coordinate to orbit around. (0,0,0) is default. */
    readonly pivot?: ReadonlyVec3;

    /** The current pitch of camera in degrees (+/-90) */
    readonly pitch?: number;

    /** The current yaw of camera in degrees (+/-180) */
    readonly yaw?: number;

    /** The camera distance relative to pivot point in meters. */
    readonly distance?: number;

    /** The camera distance relative to pivot point in meters. */
    readonly maxDistance?: number;

    /** Linear velocity modifier (default is 1.0) */
    readonly linearVelocity?: number;

    /** Rotational velocity modifier (default is 1.0) */
    readonly rotationalVelocity?: number;

    /** The vertical camera field of view in degrees (default is 45). */
    readonly fieldOfView?: number;
}

export class OrbitController extends BaseController {
    static readonly defaultParams = {
        pivot: [0, 0, 0],
        distance: 15,
        pitch: -30,
        yaw: 30,
        maxDistance: 1000,
        linearVelocity: 1,
        rotationalVelocity: 1,
        fieldOfView: 45,
    } as const;

    override kind = "orbit" as const;
    override projection = "pinhole" as const;
    override changed = false;
    private params;
    private readonly orientation = new PitchRollYawOrientation();
    private pivot: ReadonlyVec3 = vec3.create();
    private distance: number;
    private fov: number;

    constructor(input: ControllerInput, params?: OrbitControllerParams) {
        super(input);
        const { pitch, yaw, distance, pivot, fieldOfView } = this.params = { ...OrbitController.defaultParams, ...params } as const;
        const { orientation } = this;
        orientation.pitch = pitch;
        orientation.yaw = yaw;
        this.distance = distance;
        this.fov = fieldOfView;
        this.pivot = pivot;
    }

    private get position() {
        const { orientation, pivot, distance } = this;
        const pos = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(pos, pos, orientation.rotation);
        vec3.add(pos, pos, pivot);
        return pos;
    }

    override serialize(includeDerived = false): ControllerInitParams {
        const { kind, pivot, orientation, distance, fov } = this;
        const { rotation } = orientation;
        this.changed = false;
        return { kind, pivot, rotation, distance, fovDegrees: fov, ...(includeDerived ? { position: this.position } : undefined) };
    }

    override updateParams(params: RecursivePartial<OrbitControllerParams>) {
        this.params = mergeRecursive(this.params, params);
    }

    override init(params: ControllerInitParams) {
        const { kind, position, rotation, pivot, fovDegrees, distance } = params;
        console.assert(kind == this.kind);
        if (fovDegrees != undefined) {
            this.fov = fovDegrees;
        }
        if (pivot) {
            this.pivot = pivot;
        }
        if (rotation) {
            this.orientation.decomposeRotation(rotation);
            this.orientation.roll = 0;
        }
        if (distance) {
            this.distance = distance;
            if (!pivot && position && rotation) {
                const tmp = vec3.fromValues(0, 0, -distance);
                vec3.transformQuat(tmp, tmp, rotation);
                this.pivot = vec3.add(tmp, tmp, position);
            }
        }
        if (position && pivot) {
            const { orientation } = this;
            if (!distance) {
                this.distance = vec3.distance(position, pivot);
            }
            if (!rotation) {
                const [x, y, z] = vec3.sub(vec3.create(), position, pivot);
                const pitch = Math.atan2(-y, vec2.len(vec2.fromValues(x, z)));
                const yaw = Math.atan2(x, z);
                orientation.yaw = yaw * 180 / Math.PI;
                orientation.pitch = pitch * 180 / Math.PI;
                orientation.roll = 0;
            }
        }
        this.attach();
        this.changed = true;
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
        const { params } = this;
        this.pivot = center;
        this.distance = Math.min(params.maxDistance, radius / Math.tan(glMatrix.toRadian(this.fov) / 2));
        this.changed = true;
    }

    override update() {
        const { axes, multiplier, pivot, orientation, distance, fov, params, height } = this;
        const tx = axes.keyboard_ad + axes.mouse_rmb_move_x - axes.touch_2_move_x;
        const ty = -axes.keyboard_qe + axes.mouse_rmb_move_y - axes.touch_2_move_y;
        const tz = axes.keyboard_ws * 2 + axes.mouse_mmb_move_y + axes.mouse_wheel / 2 + axes.touch_pinch2 * 2;
        const rx = axes.keyboard_arrow_up_down / 5 + axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const ry = axes.keyboard_arrow_left_right / 5 + axes.mouse_lmb_move_x + axes.touch_1_move_x;

        orientation.roll = 0;
        const rotationalVelocity = 180 * params.rotationalVelocity / height;
        if (rx || ry) {
            orientation.pitch += -rx * rotationalVelocity;
            orientation.yaw += -ry * rotationalVelocity;
            this.changed = true;
        }

        const fovRatio = Math.tan(((Math.PI / 180) * fov) / 2) * 2;
        const linearVelocity = distance * fovRatio * multiplier * params.linearVelocity / height;
        if (tz) {
            this.distance += tz * linearVelocity;
            this.changed = true;
        } else if (tx || ty) {
            const worldPosDelta = vec3.transformQuat(vec3.create(), vec3.fromValues(tx * linearVelocity, -ty * linearVelocity, 0), orientation.rotation);
            this.pivot = vec3.add(vec3.create(), pivot, worldPosDelta);
            this.changed = true;
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const { pivot, orientation, position, fov } = this;
        const changes: MutableCameraState = {};
        if (!state || !vec3.exactEquals(state.position, position)) {
            changes.position = position;
        }
        if (!state || state.rotation !== orientation.rotation) {
            changes.rotation = orientation.rotation;
        }
        if (!state || state.pivot !== pivot) {
            changes.pivot = pivot;
        }
        if (!state || state.fov !== fov) {
            changes.fov = fov;
        }
        if (!state) {
            changes.kind = "pinhole";
        }
        return changes;
    }
}