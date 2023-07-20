
import { type ReadonlyVec3, vec3, type ReadonlyQuat, glMatrix, quat } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState } from "./base";
import { mergeRecursive, type BoundingSphere, type RecursivePartial, type RenderStateCamera } from "core3d";
import { PitchRollYawOrientation, decomposeRotation } from "./orientation";
import { ControllerInput } from "./input";

/** Ortho type camera motion controller */
export interface OrthoControllerParams {
    readonly position?: ReadonlyVec3;
    readonly rotation?: ReadonlyQuat;
    readonly fieldOfView?: number;
    readonly stepInterval?: number;
    readonly usePointerLock?: boolean
}

export class OrthoController extends BaseController {
    static readonly defaultParams = {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        fieldOfView: 45,
        stepInterval: 1,
        usePointerLock: false,
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
        if (this.input.callbacks == this) {
            this.input.usePointerLock = this.params.usePointerLock;
        }
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
        this.input.usePointerLock = this.params.usePointerLock;
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

    override update() {
        const { axes, zoomPos, height, position, orientation, hasShift, currentFlyTo } = this;

        if (currentFlyTo) {
            this.position = vec3.clone(currentFlyTo.pos);
            orientation.pitch = currentFlyTo.pitch;
            orientation.yaw = currentFlyTo.yaw;
            this.changed = true;
            return;
        }


        let tx = -axes.keyboard_ad + axes.mouse_lmb_move_x + axes.mouse_rmb_move_x + axes.mouse_mmb_move_x + axes.touch_1_move_x;
        let ty = -axes.keyboard_ws + axes.mouse_lmb_move_y + axes.mouse_rmb_move_y + axes.mouse_mmb_move_y + axes.touch_1_move_y;
        const tz = (axes.touch_pinch3 * 0.1) + (hasShift ? axes.mouse_wheel * 0.01 : 0);
        const rz = -axes.keyboard_arrow_left_right / 2;
        const zoom = (hasShift ? 0 : axes.mouse_wheel) + axes.touch_pinch2 - axes.keyboard_qe;
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