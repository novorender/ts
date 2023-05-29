
import { type ReadonlyVec3, vec3, type ReadonlyQuat } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState } from "./base";
import { mergeRecursive, type RecursivePartial, type RenderStateCamera } from "core3d";
import { PitchRollYawOrientation } from "./orientation";
import { ControllerInput } from "./input";

/** Ortho type camera motion controller */
export interface OrthoControllerParams {
    readonly position?: ReadonlyVec3;
    readonly rotation?: ReadonlyQuat;
    readonly fieldOfView?: number;
    readonly stepInterval?: number;
}

export class OrthoController extends BaseController {
    static readonly defaultParams = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        fieldOfView: 45,
        stepInterval: 1
    } as const;

    override kind = "ortho" as const;
    override projection = "orthographic" as const;
    override changed = false;
    private params;
    private position: ReadonlyVec3;
    private orientation = new PitchRollYawOrientation();
    private fov: number;

    constructor(input: ControllerInput, params?: OrthoControllerParams) {
        super(input);
        const { position, rotation, fieldOfView } = this.params = { ...OrthoController.defaultParams, ...params } as const;
        this.position = position;
        this.orientation.decomposeRotation(rotation);
        this.fov = fieldOfView;
    }

    override serialize(): ControllerInitParams {
        const { kind, position, orientation, fov } = this;
        const { rotation } = orientation;
        this.changed = false;
        return { kind, position, rotation, fovMeters: fov };
    }

    override updateParams(params: RecursivePartial<OrthoControllerParams>) {
        this.params = mergeRecursive(this.params, params);
    }

    override init(params: ControllerInitParams) {
        const { kind, position, rotation, fovMeters, distance, fovDegrees } = params;
        console.assert(kind == this.kind);
        if (position) {
            this.position = position;
        }
        if (rotation) {
            this.orientation.decomposeRotation(rotation);
        }
        if (fovMeters) {
            this.fov = fovMeters;
        } else if (fovDegrees && distance) {
            this.fov = OrthoController.fovFromPerspective(fovDegrees, distance);
        }
        this.changed = true;
        this.input.callbacks = this;
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
        const { orientation } = this;
        const dir = vec3.fromValues(0, 0, radius);
        vec3.transformQuat(dir, dir, orientation.rotation);
        this.position = vec3.add(vec3.create(), center, dir);
        this.orientation.pitch = -90;
        this.orientation.yaw = 0;
        this.orientation.roll = 0;
        this.fov = radius * 2;
        this.changed = true;
    }

    override update() {
        const { axes, zoomPos, height, position, orientation, hasShift } = this;

        let tx = -axes.keyboard_ad + axes.mouse_lmb_move_x + axes.touch_1_move_x;
        let ty = -axes.keyboard_ws + axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const tz = (axes.mouse_navigate * this.params.stepInterval) + (axes.touch_pinch3 * 0.1) + (hasShift ? axes.mouse_wheel * 0.01 : 0);
        const rz = axes.keyboard_qe;
        const zoom = (hasShift ? 0 : axes.mouse_wheel) + axes.touch_pinch2;
        const [zoomX, zoomY] = zoomPos;

        if (rz) {
            orientation.roll += rz * 0.2;
            this.changed = true;
        }
        if (tx || ty || tz || zoom) {
            if (zoom != 0) {
                const dz = 1 + (zoom / height);
                tx += zoomX * -zoom * 0.6;
                ty += zoomY * zoom * 0.6;
                this.fov *= dz;
            }
            const scale = this.fov / height;
            const deltaPos = vec3.transformQuat(vec3.create(), vec3.fromValues(tx * scale * -1, ty * scale, tz), orientation.rotation);
            this.position = vec3.add(vec3.create(), position, deltaPos);
            this.changed = true;
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const changes: MutableCameraState = {};
        if (!state || state.position !== this.position) {
            changes.position = this.position;
        }
        if (!state || state.rotation !== this.orientation.rotation) {
            changes.rotation = this.orientation.rotation;
        }
        if (!state || state.fov !== this.fov) {
            changes.fov = this.fov;
        }
        if (!state) {
            changes.kind = "orthographic";
        }
        return changes;
    }

    //perspectiveDepth = BaseController.getDistanceFromViewPlane(pivot);
    static fovFromPerspective(perspectiveFov: number, perspectiveDepth: number) {
        return Math.max(0.1, perspectiveDepth) * Math.tan(((Math.PI / 180) * perspectiveFov) / 2) * 2;
    }
}