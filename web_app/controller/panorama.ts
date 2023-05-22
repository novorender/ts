
import { type ReadonlyVec3, vec3, type ReadonlyQuat, glMatrix, quat } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState } from "./base";
import { type RenderStateScene, type RenderStateCamera, type RenderState, mergeRecursive, type RecursivePartial } from "@novorender/core3d";
import { PitchRollYawOrientation } from "./orientation";
import { ControllerInput, MouseButtons } from "./input";

/** Ortho type camera motion controller */
export interface PanoramaControllerParams {
    position?: ReadonlyVec3;
    pitch?: number;
    yaw?: number;
    rotationalVelocity?: number;
    fieldOfView?: number;
}


export class PanoramaController extends BaseController {
    static readonly defaultParams = {
        position: [0, 0, 0],
        pitch: -30,
        yaw: 30,
        rotationalVelocity: 1,
        fieldOfView: 60,
    };

    override kind = "panorama" as const;
    override projection = "pinhole" as const;
    override changed = false;
    private params;
    private position: ReadonlyVec3 = vec3.create();
    private readonly orientation = new PitchRollYawOrientation();
    private fov: number;

    constructor(input: ControllerInput, params?: PanoramaControllerParams) {
        super(input);
        this.params = { ...PanoramaController.defaultParams, ...params } as const;
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

    override updateParams(params: RecursivePartial<PanoramaControllerParams>) {
        this.params = mergeRecursive(this.params, params);
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
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
        const { orientation } = this;
        const maxDistance = 1000;
        const distance = Math.min(maxDistance, radius / Math.tan(glMatrix.toRadian(this.fov) / 2));
        const dir = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(dir, dir, orientation.rotation);
        this.position = vec3.add(vec3.create(), center, dir)
    }

    override update(): void {
        const { axes, orientation, params, height, fov } = this;
        const tz = axes.keyboard_ws + axes.mouse_wheel + axes.touch_pinch2;
        const rx = -axes.keyboard_arrow_up_down / 5 - axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const ry = -axes.keyboard_arrow_left_right / 5 - axes.mouse_lmb_move_x + axes.touch_1_move_x;
        orientation.roll = 0;

        if (rx || ry) {
            const rotationalVelocity = this.fov * params.rotationalVelocity / height;
            orientation.pitch += rx * rotationalVelocity;
            orientation.yaw += ry * rotationalVelocity;
            this.changed = true;
        }

        if (tz) {
            const dz = 1 + (tz / height);
            this.fov = Math.max(Math.min(60, fov * dz), 0.1);
            this.changed = true;
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const changes: MutableCameraState = {};
        const { position, orientation, fov } = this;
        if (!state || state.position !== position) {
            changes.position = position;
        }
        if (!state || state.rotation !== orientation.rotation) {
            changes.rotation = orientation.rotation;
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