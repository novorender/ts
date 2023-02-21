import { glMatrix, mat3, quat, ReadonlyVec3, vec2, vec3 } from "gl-matrix";
import { modifyRenderState, RenderState, RenderStateCamera, RenderStateChanges, RenderStateScene } from "./state";

function clamp(v: number, min: number, max: number) {
    if (v < min) {
        v = min;
    } else if (v > max) {
        v = max;
    }
    return v;
}

abstract class BaseController {
    enabled = true;
    needPointerLock = false;

    readonly domElement;
    readonly position = vec3.create();
    readonly rotation = quat.create();
    protected readonly mouseButtonsMap = { rotate: 1, pan: 4, orbit: 2, pivot: 2 };
    protected readonly fingersMap = { rotate: 1, pan: 2, orbit: 3, pivot: 3 };
    protected readonly keys = new Set<string>();


    protected pointerTable: readonly { readonly id: number; readonly x: number; readonly y: number; }[] = [];

    private _touchMovePrev = vec2.create();
    private _touchZoomDistancePrev = 0;

    constructor(domElement?: HTMLElement) {
        this.domElement = domElement ?? document.body;
        this.connect();
    }

    dispose() {
        this.disconnect();
    }

    protected connect() {
        const { domElement } = this;
        if (!domElement) return;
        const options = false;
        domElement.tabIndex = 0;
        domElement.addEventListener("keydown", this.keydown, options);
        domElement.addEventListener("keyup", this.keyup, options);
        domElement.addEventListener("blur", this.blur, options);
        domElement.addEventListener("click", this.click, options);
        domElement.addEventListener("contextmenu", this.contextmenu, options);
        domElement.addEventListener("mousedown", this.mousedown, options);
        domElement.addEventListener("mouseup", this.mouseup, options);
        domElement.addEventListener("mousemove", this.mousemove, options);
        domElement.addEventListener("wheel", this.wheel, options);
        domElement.addEventListener("touchstart", this.touchstart, options);
        domElement.addEventListener("touchmove", this.touchmove, options);
        domElement.addEventListener("touchend", this.touchend, options);
        domElement.addEventListener("touchcancel", this.touchcancel, options);
    }

    protected disconnect() {
        const { domElement } = this;
        if (!domElement) return;
        const options = false;
        domElement.removeEventListener("keydown", this.keydown, options);
        domElement.removeEventListener("keyup", this.keyup, options);
        domElement.removeEventListener("blur", this.blur, options);
        domElement.removeEventListener("click", this.click, options);
        domElement.removeEventListener("contextmenu", this.contextmenu, options);
        domElement.removeEventListener("mousedown", this.mousedown, options);
        domElement.removeEventListener("mouseup", this.mouseup, options);
        domElement.removeEventListener("mousemove", this.mousemove, options);
        domElement.removeEventListener("wheel", this.wheel, options);
        domElement.removeEventListener("touchstart", this.touchstart, options);
        domElement.removeEventListener("touchmove", this.touchmove, options);
        domElement.removeEventListener("touchend", this.touchend, options);
        domElement.removeEventListener("touchcancel", this.touchcancel, options);
    }

    private click = (e: Event) => {
        e.preventDefault();
    };

    private contextmenu = (e: Event) => {
        e.preventDefault();
    };

    private keydown = (e: KeyboardEvent) => {
        switch (e.code) {
            case "KeyW":
            case "KeyS":
            case "KeyA":
            case "KeyD":
            case "KeyQ":
            case "KeyE":
                e.preventDefault();
        }
        this.keys.add(e.code);
    };

    private keyup = (e: KeyboardEvent) => {
        switch (e.code) {
            case "KeyW":
            case "KeyS":
            case "KeyA":
            case "KeyD":
            case "KeyQ":
            case "KeyE":
                e.preventDefault();
        }
        this.keys.delete(e.code);
    };

    private blur = (e: FocusEvent) => {
        if ("exitPointerLock" in document) document.exitPointerLock();
        this.keys.clear();
    };

    private mousedown = (e: MouseEvent) => {
        if (!this.enabled) return;
        this.needPointerLock = true;
        this.domElement.focus();
        e.preventDefault();
    };

    private mouseup = (e: MouseEvent) => {
        if (!this.enabled) return;
        e.preventDefault();
        if ("exitPointerLock" in document) document.exitPointerLock();
        this.needPointerLock = false;
    };

    private wheel = (e: WheelEvent) => {
        if (!this.enabled) return;
        this.zoom(e.deltaY, e.offsetX, e.offsetY);
    };

    private mousemove = (e: MouseEvent) => {
        if (!this.enabled) return;
        if (e.buttons < 1) return;
        if (Math.abs(e.movementX) > 100 || Math.abs(e.movementY) > 100) return;
        if (this.needPointerLock) {
            (e.currentTarget as HTMLElement).requestPointerLock();
            this.needPointerLock = false;
        }
        if (e.buttons & this.mouseButtonsMap.orbit) {
            const rot = mat3.create();
            mat3.fromQuat(rot, this.rotation);
            this.orbit(e.movementX, e.movementY, rot, true);
        } else if (e.buttons & this.mouseButtonsMap.pan) {
            const rot = mat3.create();
            mat3.fromQuat(rot, this.rotation);
            this.pan(e.movementX, e.movementY, rot);
        } else if (e.buttons & this.mouseButtonsMap.rotate) {
            this.rotate(e.movementX, e.movementY);
        }
    };

    private touchstart = (event: TouchEvent) => {
        if (!this.enabled) return;
        event.stopPropagation();
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
        const { pointerTable, _touchMovePrev } = this;

        switch (pointerTable.length) {
            case 1:
                vec2.set(_touchMovePrev, pointerTable[0].x, pointerTable[0].y);
                break;
            default: // 2 or more
                const dx = pointerTable[0].x - pointerTable[1].x;
                const dy = pointerTable[0].y - pointerTable[1].y;
                this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);

                const x = (pointerTable[0].x + pointerTable[1].x) / 2;
                const y = (pointerTable[0].y + pointerTable[1].y) / 2;
                vec2.set(_touchMovePrev, x, y);
                break;
        }
    };

    private touchend = (event: TouchEvent) => {
        if (!this.enabled) return;
        event.stopPropagation();
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
        const { pointerTable, _touchMovePrev } = this;
        switch (pointerTable.length) {
            case 0:
                break;
            case 1:
                vec2.set(_touchMovePrev, pointerTable[0].x, pointerTable[0].y);
                break;
            default:
                const dx = pointerTable[0].x - pointerTable[1].x;
                const dy = pointerTable[0].y - pointerTable[1].y;
                this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);

                const x = (pointerTable[0].x + pointerTable[1].x) / 2;
                const y = (pointerTable[0].y + pointerTable[1].y) / 2;
                vec2.set(_touchMovePrev, x, y);
                break;
        }
    };

    private touchcancel = (event: TouchEvent) => {
        if (!this.enabled) return;
        event.preventDefault();
        event.stopPropagation();
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
    };

    private touchmove = (event: TouchEvent) => {
        if (!this.enabled) return;
        if (event.cancelable) event.preventDefault();
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
        const { pointerTable, _touchMovePrev } = this;
        let { x, y } = pointerTable[0];

        if (pointerTable.length > 1) {
            const dx = pointerTable[0].x - pointerTable[1].x;
            const dy = pointerTable[0].y - pointerTable[1].y;
            const touchZoomDistance = Math.sqrt(dx * dx + dy * dy);

            x = (pointerTable[0].x + pointerTable[1].x) / 2;
            y = (pointerTable[0].y + pointerTable[1].y) / 2;

            const deltaWheel = this._touchZoomDistancePrev - touchZoomDistance; // / this.domElement.clientHeight;
            this._touchZoomDistancePrev = touchZoomDistance;
            this.zoom(deltaWheel, x, y);
        }
        switch (pointerTable.length) {
            case this.fingersMap.rotate:
                this.rotate(x - _touchMovePrev[0], y - _touchMovePrev[1]);
                break;
            case this.fingersMap.orbit:
                this.orbit(_touchMovePrev[0] - x, _touchMovePrev[1] - y, mat3.fromQuat(mat3.create(), this.rotation));
                break;
            case this.fingersMap.pan:
                this.pan(x - _touchMovePrev[0], y - _touchMovePrev[1], mat3.fromQuat(mat3.create(), this.rotation));
                break;
        }
        vec2.set(_touchMovePrev, x, y);
    };

    protected rotate(deltaX: number, deltaY: number): void { }
    protected pan(deltaX: number, deltaY: number, rot: mat3): void { }
    protected orbit(deltaX: number, deltaY: number, rot: mat3, invert?: boolean): void { }
    protected zoom(delta: number, x: number, y: number): void { }
    abstract autoFitToScene(scene: RenderStateScene, camera: RenderStateCamera): void;
    abstract update(): void;

    renderStateChanges(state: RenderState): RenderStateChanges | undefined {
        const { camera } = state;
        this.update();
        const { position, rotation } = this;
        if (!vec3.exactEquals(camera.position, position) || !quat.exactEquals(camera.rotation, rotation)) {
            return { camera: { position: vec3.clone(position), rotation: quat.clone(rotation) } };
        }
        return undefined;
    }
}


/** Orbit type camera motion controller */
export interface OrbitControllerParams {
    /** The kind of camera controller. */
    readonly kind: "orbit";

    /** The world space coordinate to orbit around. (0,0,0) is default. */
    pivotPoint?: ReadonlyVec3;

    /** The current pitch of camera in degrees (+/-90) */
    pitch?: number;

    /** The current yaw of camera in degrees (+/-180) */
    yaw?: number;

    /** The camera distance relative to pivot point in meters. */
    distance?: number;

    /** The camera distance relative to pivot point in meters. */
    maxDistance?: number;

    /** The velocity with which the camera moves through space in meters/second */
    linearVelocity?: number;

    /** The velocity with which the camera rotates in degrees/second. */
    rotationalVelocity?: number;
}

export class OrbitController extends BaseController {
    static readonly defaultParams = {
        kind: "orbit" as const,
        pivotPoint: vec3.create(),
        distance: 15,
        pitch: 30,
        yaw: 0,
        maxDistance: 1000,
        rotationalVelocity: 0.2,
        linearVelocity: 0.01,
    } as const;

    mouseButtonsMap = { rotate: 1, pan: 2, orbit: 0, pivot: 0 };

    readonly params;
    pitch: number;
    yaw: number;
    distance: number;
    readonly pivotPoint = vec3.create();

    constructor(params: OrbitControllerParams, domElement?: HTMLElement) {
        super(domElement);
        const { pitch, yaw, distance, pivotPoint } = this.params = { ...OrbitController.defaultParams, ...params } as const;
        this.pitch = pitch;
        this.yaw = yaw;
        this.distance = distance;
        vec3.copy(this.pivotPoint, pivotPoint);
    }

    private wrapYaw() {
        while (this.yaw >= 360) this.yaw -= 360;
        while (this.yaw < 0) this.yaw += 360;
    }

    private clampPitch() {
        this.pitch = clamp(this.pitch, -89, 89);
    }

    private clampDistance() {
        this.distance = clamp(this.distance, 0, this.params.maxDistance);
    }

    private get multiplier() {
        const { keys } = this;
        let multiplier = 1;
        if (keys.has("ShiftLeft")) multiplier *= 10;
        if (keys.has("ShiftRight")) multiplier *= 10;
        if (keys.has("AltLeft")) multiplier *= 0.1;
        if (keys.has("AltRight")) multiplier *= 0.1;
        return multiplier;
    }

    rotate(deltaX: number, deltaY: number) {
        const { params } = this;
        const { rotationalVelocity } = params;
        this.yaw += -deltaX * rotationalVelocity;
        this.pitch += deltaY * rotationalVelocity;
        this.wrapYaw();
        this.clampPitch();
    }

    pan(deltaX: number, deltaY: number, rot: mat3) {
        const { pivotPoint, params, multiplier } = this;
        const { linearVelocity } = params;
        const dx = vec3.fromValues(-deltaX * linearVelocity * multiplier, 0, 0);
        const dy = vec3.fromValues(0, deltaY * linearVelocity * multiplier, 0);
        const d = vec3.create();
        vec3.transformMat3(dx, dx, rot);
        vec3.transformMat3(dy, dy, rot);
        vec3.add(d, dx, dy);
        vec3.add(pivotPoint, pivotPoint, d);
    }

    zoom(delta: number) {
        const { params, multiplier, distance } = this;
        this.distance += delta * params.linearVelocity * multiplier * distance / 100;
        this.clampDistance();
    }

    setPosition(position: ReadonlyVec3) {
        const { pivotPoint } = this;
        this.distance = vec3.distance(position, pivotPoint);
        const [x, y, z] = vec3.sub(vec3.create(), position, pivotPoint);
        const pitch = Math.atan2(y, vec2.len(vec2.fromValues(x, z)));
        const yaw = Math.atan2(x, z);
        this.yaw = yaw * 180 / Math.PI;
        this.pitch = pitch * 180 / Math.PI;
    }

    override autoFitToScene(scene: RenderStateScene, camera: RenderStateCamera, centerPos?: ReadonlyVec3): void {
        const { pivotPoint } = this;
        const { center, radius } = scene.config.boundingSphere;
        vec3.copy(pivotPoint, centerPos ?? center);
        const maxDistance = 100;

        switch (camera.kind) {
            case "pinhole":
                this.distance = Math.min(maxDistance, radius / Math.tan(glMatrix.toRadian(camera.fov) / 2));
                break;
            case "orthographic":
                this.distance = Math.min(maxDistance, radius);
                // camera.fieldOfView = radius * 2;
                break;
        }
    }

    override update() {
        const { position, rotation, yaw, pitch, distance, pivotPoint } = this;
        const yawAngle = glMatrix.toRadian(yaw);
        const pitchAngle = glMatrix.toRadian(pitch);
        const rot = quat.create();
        quat.rotateY(rot, rot, yawAngle);
        quat.rotateX(rotation, rot, -pitchAngle);
        const pos = vec3.fromValues(0, 0, distance);
        vec3.transformQuat(pos, pos, rotation);
        vec3.add(position, pivotPoint, pos);
    }
}
