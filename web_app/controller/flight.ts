
import { type ReadonlyVec3, vec3, glMatrix, quat } from "gl-matrix";
import { BaseController, type ControllerContext, type ControllerInitParams, type MutableCameraState } from "./base";
import { type RenderStateCamera, type RecursivePartial, mergeRecursive } from "@novorender/core3d";
import { PitchRollYawOrientation, clamp } from "./orientation";
import { ControllerInput, MouseButtons } from "./input";

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
        pickDelay: 100
    };

    override kind = "flight" as const;
    override projection = "pinhole" as const;
    override changed = false;
    private params;
    private position: ReadonlyVec3 = vec3.create();
    private readonly orientation = new PitchRollYawOrientation();
    private pivot: Pivot | undefined;
    private fov: number;
    private prevMouseButtons = MouseButtons.none;

    private lastUpdatedMoveBegin: number = 0;
    private lastUpdate: number = 0;
    private lastRecordePoistion: ReadonlyVec3 | undefined = undefined;
    private recordedMoveBegin: ReadonlyVec3 | undefined = undefined;

    constructor(readonly context: ControllerContext, input: ControllerInput, params?: FlightControllerParams) {
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

    override flyTo(flyTime: number, targetPosition: ReadonlyVec3, targetPitch?: number, targetYaw?: number): void {
        const { orientation, position } = this;
        this.setFlyTo({
            remainingFlightTime: flyTime,
            target: { pos: vec3.clone(targetPosition), pitch: targetPitch ?? orientation.pitch, yaw: targetYaw ?? orientation.yaw },
            current: { pos: vec3.clone(position), pitch: orientation.pitch, yaw: orientation.yaw }
        });
    }


    private proportinalSpeed() {
        const { axes, params, recordedMoveBegin, position, fov } = this;
        const { proportionalCameraSpeed } = params;
        let scale = 20;
        if (proportionalCameraSpeed && recordedMoveBegin) {
            scale = vec3.dist(position, recordedMoveBegin) * Math.tan(((Math.PI / 180) * fov) / 2) * 2;
            const mouseWheelModifier = clamp(scale / 3, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const mousePanModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const touchMovementModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            const pinchModifier = clamp(scale, proportionalCameraSpeed.min, proportionalCameraSpeed.max);
            return {
                tx: (axes.keyboard_ad * scale) - (axes.mouse_mmb_move_x * mousePanModifier) - (axes.touch_2_move_x * touchMovementModifier),
                ty: (axes.keyboard_qe * scale) - (axes.mouse_mmb_move_y * mousePanModifier) - (axes.touch_2_move_y * touchMovementModifier),
                tz: (axes.keyboard_ws * scale) + (axes.mouse_wheel * mouseWheelModifier) + (axes.touch_pinch2 * pinchModifier)
            }
        }
        return {
            tx: (axes.keyboard_ad - axes.mouse_mmb_move_x - axes.touch_2_move_x) * scale,
            ty: (axes.keyboard_qe - axes.mouse_mmb_move_y - axes.touch_2_move_y) * scale,
            tz: (axes.keyboard_ws + axes.mouse_wheel * 10 + axes.touch_pinch2) * scale
        }
    }

    override update(): void {
        const { axes, multiplier, orientation, params, height, pivot, zoomPos, currentFlyTo } = this;
        if (currentFlyTo) {
            this.position = vec3.clone(currentFlyTo.pos);
            orientation.pitch = currentFlyTo.pitch;
            orientation.yaw = currentFlyTo.yaw;
            this.changed = true;
            return;
        }
        this.lastUpdate = performance.now();
        console.log("update");

        const rotX = -axes.keyboard_arrow_up_down / 5 - axes.mouse_lmb_move_y + axes.touch_1_move_y;
        const rotY = -axes.keyboard_arrow_left_right / 5 - axes.mouse_lmb_move_x + axes.touch_1_move_x;
        const pivotX = -axes.mouse_rmb_move_y + axes.touch_3_move_y;
        const pivotY = -axes.mouse_rmb_move_x + axes.touch_3_move_x;
        const shouldPivot = Math.abs(rotX) + Math.abs(rotY) < Math.abs(pivotX) + Math.abs(pivotY);

        let { tx, ty, tz } = this.proportinalSpeed();
        const rx = shouldPivot ? pivotX : rotX;
        const ry = shouldPivot ? pivotY : rotY;
        orientation.roll = 0;
        const [zoomX, zoomY] = zoomPos;

        if (rx || ry) {
            const rotationalVelocity = (shouldPivot ? 180 : this.fov) * params.rotationalVelocity / height;
            orientation.pitch += rx * rotationalVelocity;
            orientation.yaw += ry * rotationalVelocity;
            if (pivot && shouldPivot) {
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
            this.changed = true;
        }
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        const changes: MutableCameraState = {};
        const { position, orientation, pivot, fov } = this;
        if (!state || state.position !== position) {
            changes.position = position;
        }
        if (!state || state.rotation !== orientation.rotation) {
            changes.rotation = orientation.rotation;
        }
        if (!state || state.pivot !== pivot?.center) {
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
        const { context, prevMouseButtons } = this;
        const { renderContext } = context;
        const changes = event.buttons ^ prevMouseButtons;
        if (changes & (MouseButtons.right | MouseButtons.middle)) {
            if (renderContext && event.buttons & (MouseButtons.right | MouseButtons.middle)) {
                const [sample] = await renderContext.pick(event.offsetX, event.offsetY);
                if (sample) {
                    this.setPivot(sample.position);
                } else {
                    this.resetPivot();
                }
            } else {
                this.resetPivot();
            }
        }
        this.prevMouseButtons = event.buttons;
    }

    override async touchChanged(event: TouchEvent): Promise<void> {
        const { pointerTable, context } = this;
        const { renderContext } = context;
        if (pointerTable.length == 3 && renderContext) {
            const [sample] = await renderContext.pick(Math.round((pointerTable[0].x + pointerTable[1].x) / 2), Math.round((pointerTable[0].y + pointerTable[1].y) / 2));
            if (sample) {
                this.setPivot(sample.position);
            } else {
                this.resetPivot();
            }
        } else {
            this.resetPivot();
        }
    }

    async moveBegin(event: TouchEvent | MouseEvent): Promise<void> {
        const { pointerTable, context } = this;
        const { renderContext } = context;
        const deltaTime = this.lastUpdate - this.lastUpdatedMoveBegin;
        if (renderContext == undefined || deltaTime < this.params.pickDelay) {
            return;
        }

        const setPickPosition = async (x: number, y: number) => {
            const [sample] = await renderContext.pick(x, y);
            if (sample) {
                this.recordedMoveBegin = this.lastRecordePoistion = sample.position;
                this.lastUpdatedMoveBegin = performance.now();
            } else {
                this.recordedMoveBegin = undefined;
                this.lastUpdatedMoveBegin = performance.now();
            }
        }

        if (event instanceof TouchEvent) {
            if (pointerTable.length > 1) {
                setPickPosition(Math.round((pointerTable[0].x + pointerTable[1].x) / 2), Math.round((pointerTable[0].y + pointerTable[1].y) / 2))
            }
        } else {
            setPickPosition(event.offsetX, event.offsetY)
        }
    }

    private resetPivot() {
        const { pivot } = this;
        if (pivot) {
            this.setPivot(pivot.center);
        }
    }

    private setPivot(center: ReadonlyVec3) {
        const { position, orientation } = this;
        const distance = vec3.distance(center, position);
        const offset = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(offset, offset, orientation.rotation);
        vec3.add(offset, center, offset);
        vec3.sub(offset, position, offset);
        const invRot = quat.invert(quat.create(), orientation.rotation);
        vec3.transformQuat(offset, offset, invRot)
        this.pivot = { center, offset, distance };
    }
}