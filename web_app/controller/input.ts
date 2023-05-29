import { vec2 } from "gl-matrix";

export class ControllerInput {
    readonly domElement;
    callbacks: ContollerInputContext | undefined;
    readonly axes: ControllerAxes;
    pointerTable: readonly { readonly id: number; readonly x: number; readonly y: number; }[] = [];
    private readonly _keys = new Set<string>();
    private _mouseButtonDown = false;
    private _zoomY = 0;
    private _zoomX = 0;
    private readonly _touchMovePrev = [0, 0] as [number, number];
    private _touchZoomDistancePrev = 0;
    private prevTouchCenter: vec2 | undefined = undefined;

    private _mouseButtons = MouseButtons.none;
    private _fingers = 0;
    private _mouseWheelLastActive = 0;
    private static readonly _gestureKeys = ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    usePointerLock = true;

    constructor(domElement?: HTMLElement) {
        this.domElement = domElement ?? document.body;
        this.connect();
        this.axes = {} as ControllerAxes;
        this.resetAxes();
    }

    dispose() {
        this.disconnect();
    }

    get moving() {
        return this.isAnyGestureKeyPressed() || this._mouseButtons != 0 || this._fingers != 0 || (performance.now() - this._mouseWheelLastActive) < 100;
    }

    get width() {
        return this.domElement.clientWidth;
    }

    get height() {
        return this.domElement.clientHeight;
    }

    get multiplier() {
        const { _keys } = this;
        let m = 1;
        if (_keys.has("ShiftLeft")) m *= 10;
        if (_keys.has("ShiftRight")) m *= 10;
        if (_keys.has("ControlRight")) m *= 10;
        if (_keys.has("AltLeft")) m *= 0.1;
        if (_keys.has("AltRight")) m *= 0.1;
        return m;
    }

    get hasShift() {
        const { _keys } = this;
        if (_keys.has("ShiftLeft")) return true;
        if (_keys.has("ShiftRight")) return true;
        return false;
    }

    get zoomPos() {
        const { width, height, _zoomX, _zoomY } = this;
        if (_zoomX == 0 && _zoomY == 0) {
            return [0, 0];
        }
        return [-(_zoomX - width / 2) / height * 2, (_zoomY - height / 2) / height * 2];
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
        domElement.focus();
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

    private static isGestureKey(code: string) {
        return ControllerInput._gestureKeys.indexOf(code) != -1;
    }

    private isAnyGestureKeyPressed() {
        return [...this._keys].some(key => ControllerInput.isGestureKey(key));
    }

    private keydown = (e: KeyboardEvent) => {
        if (ControllerInput.isGestureKey(e.code)) {
            e.preventDefault();
        }
        this._keys.add(e.code);
        this._zoomX = 0;
        this._zoomY = 0;
    };

    private keyup = (e: KeyboardEvent) => {
        if (ControllerInput.isGestureKey(e.code)) {
            e.preventDefault();
        }
        this._keys.delete(e.code);
    };

    private blur = (e: FocusEvent) => {
        if ("exitPointerLock" in document) document.exitPointerLock();
        this._keys.clear();
    };

    private mousedown = async (e: MouseEvent) => {
        const { domElement, axes } = this;
        this._mouseButtonDown = true;
        domElement.focus();
        e.preventDefault();
        this.callbacks?.mouseButtonChanged?.(e);
        await this.callbacks?.moveBegin?.(e);
        this._mouseButtons = e.buttons;
        if (e.buttons & MouseButtons.forward) {
            axes.mouse_navigate--;
        } else if (e.buttons & MouseButtons.backward) {
            axes.mouse_navigate++;
        }
    };

    private mouseup = (e: MouseEvent) => {
        e.preventDefault();
        this._mouseButtons = e.buttons;
        if ("exitPointerLock" in document) document.exitPointerLock();
        this.callbacks?.mouseButtonChanged?.(e);
        this._mouseButtonDown = false;
    };

    private wheel = async (e: WheelEvent) => {
        const { axes } = this;
        this._zoomX = e.offsetX;
        this._zoomY = e.offsetY;
        await this.callbacks?.moveBegin?.(e);
        this._mouseWheelLastActive = performance.now();
        axes.mouse_wheel += e.deltaY;
    };

    private mousemove = (e: MouseEvent) => {
        if (e.buttons < 1) return;
        if (Math.abs(e.movementX) > 100 || Math.abs(e.movementY) > 100) return;
        if (this._mouseButtonDown && this.usePointerLock) {
            (e.currentTarget as HTMLElement).requestPointerLock();
            this._mouseButtonDown = false;
        }
        const { axes } = this;
        if (e.buttons & MouseButtons.right) {
            axes.mouse_rmb_move_x += e.movementX;
            axes.mouse_rmb_move_y += e.movementY;
        } else if (e.buttons & MouseButtons.middle) {
            axes.mouse_mmb_move_x += e.movementX;
            axes.mouse_mmb_move_y += e.movementY;
        } else if (e.buttons & MouseButtons.left) {
            axes.mouse_lmb_move_x += e.movementX;
            axes.mouse_lmb_move_y += e.movementY;
        }
    };

    private touchstart = async (event: TouchEvent) => {
        event.stopPropagation();
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
        const { pointerTable, _touchMovePrev } = this;
        this._fingers = event.touches.length;
        this.callbacks?.touchChanged?.(event);
        await this.callbacks?.moveBegin?.(event);

        switch (pointerTable.length) {
            case 1:
                _touchMovePrev[0] = pointerTable[0].x;
                _touchMovePrev[1] = pointerTable[0].y;
                break;
            default: // 2 or more
                const dx = pointerTable[0].x - pointerTable[1].x;
                const dy = pointerTable[0].y - pointerTable[1].y;
                this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);
                _touchMovePrev[0] = (pointerTable[0].x + pointerTable[1].x) / 2;
                _touchMovePrev[1] = (pointerTable[0].y + pointerTable[1].y) / 2;
                break;
        }
    };

    private touchend = (event: TouchEvent) => {
        event.stopPropagation();
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
        const { pointerTable, _touchMovePrev } = this;
        this._fingers = event.touches.length;
        this.callbacks?.touchChanged?.(event);
        switch (pointerTable.length) {
            case 0:
                break;
            case 1:
                _touchMovePrev[0] = pointerTable[0].x;
                _touchMovePrev[1] = pointerTable[0].y;
                break;
            default:
                const dx = pointerTable[0].x - pointerTable[1].x;
                const dy = pointerTable[0].y - pointerTable[1].y;
                this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);
                _touchMovePrev[0] = (pointerTable[0].x + pointerTable[1].x) / 2;
                _touchMovePrev[1] = (pointerTable[0].y + pointerTable[1].y) / 2;
                break;
        }
    };

    private touchcancel = (event: TouchEvent) => {
        event.preventDefault();
        event.stopPropagation();
        this._fingers = event.touches.length;
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
    };

    private touchmove = (event: TouchEvent) => {
        if (event.cancelable) event.preventDefault();
        this.pointerTable = Array.from(event.touches).map(touch => ({ id: touch.identifier, x: Math.round(touch.clientX), y: Math.round(touch.clientY) }));
        const { pointerTable, _touchMovePrev } = this;
        let { x, y } = pointerTable[0];

        const { axes } = this;
        if (pointerTable.length > 1) {
            const dx = pointerTable[0].x - pointerTable[1].x;
            const dy = pointerTable[0].y - pointerTable[1].y;
            const touchZoomDistance = Math.sqrt(dx * dx + dy * dy);

            x = (pointerTable[0].x + pointerTable[1].x) / 2;
            y = (pointerTable[0].y + pointerTable[1].y) / 2;

            const touchCenter = vec2.fromValues(x, y);
            let dist = 0;
            if (this.prevTouchCenter) {
                dist = vec2.dist(this.prevTouchCenter, touchCenter);
            }
            this.prevTouchCenter = touchCenter;

            const deltaWheel = this._touchZoomDistancePrev - touchZoomDistance; // / this.domElement.clientHeight;
            this._touchZoomDistancePrev = touchZoomDistance;
            this._zoomX = x;
            this._zoomY = y;
            if (dist * 2 < Math.abs(deltaWheel)) {
                if (pointerTable.length == 2) {
                    axes.touch_pinch2 += deltaWheel;
                } else {
                    axes.touch_pinch3 += deltaWheel;
                }
            }
        }
        switch (pointerTable.length) {
            case 1:
                axes.touch_1_move_x += x - _touchMovePrev[0];
                axes.touch_1_move_y += y - _touchMovePrev[1];
                break;
            case 2:
                axes.touch_2_move_x += x - _touchMovePrev[0];
                axes.touch_2_move_y += y - _touchMovePrev[1];
                break;
            case 3:
                axes.touch_3_move_x += x - _touchMovePrev[0];
                axes.touch_3_move_y += y - _touchMovePrev[1];
                break;
        }
        _touchMovePrev[0] = x;
        _touchMovePrev[1] = y;
    };

    animate(elapsedTime: number) {
        const { axes, _keys } = this;
        const delta = elapsedTime * this.height / 2000;
        if (_keys.size) {
            if (_keys.has("KeyA")) axes.keyboard_ad -= delta;
            if (_keys.has("KeyD")) axes.keyboard_ad += delta;
            if (_keys.has("KeyW")) axes.keyboard_ws -= delta;
            if (_keys.has("KeyS")) axes.keyboard_ws += delta;
            if (_keys.has("KeyQ")) axes.keyboard_qe -= delta;
            if (_keys.has("KeyE")) axes.keyboard_qe += delta;
            if (_keys.has("ArrowLeft")) axes.keyboard_arrow_left_right -= delta;
            if (_keys.has("ArrowRight")) axes.keyboard_arrow_left_right = delta;;
            if (_keys.has("ArrowUp")) axes.keyboard_arrow_up_down -= delta;
            if (_keys.has("ArrowDown")) axes.keyboard_arrow_up_down += delta;
        }
    }

    resetAxes() {
        const { axes } = this;
        axes.keyboard_ad = 0;
        axes.keyboard_ws = 0;
        axes.keyboard_qe = 0;
        axes.keyboard_arrow_left_right = 0;
        axes.keyboard_arrow_up_down = 0;
        axes.mouse_lmb_move_x = 0;
        axes.mouse_lmb_move_y = 0;
        axes.mouse_rmb_move_x = 0;
        axes.mouse_rmb_move_y = 0;
        axes.mouse_mmb_move_x = 0;
        axes.mouse_mmb_move_y = 0;
        axes.mouse_navigate = 0;
        axes.mouse_navigate = 0;
        axes.mouse_wheel = 0;
        axes.touch_1_move_x = 0;
        axes.touch_1_move_y = 0;
        axes.touch_2_move_x = 0;
        axes.touch_2_move_y = 0;
        axes.touch_3_move_x = 0;
        axes.touch_3_move_y = 0;
        axes.touch_pinch2 = 0;
        axes.touch_pinch3 = 0;
    }
}

export enum MouseButtons {
    none = 0,
    left = 1,
    right = 2,
    middle = 4,
    backward = 8,
    forward = 16,
}

type ControllerAxesName =
    | "keyboard_ad"
    | "keyboard_ws"
    | "keyboard_qe"
    | "keyboard_arrow_left_right"
    | "keyboard_arrow_up_down"
    | "mouse_lmb_move_x"
    | "mouse_lmb_move_y"
    | "mouse_rmb_move_x"
    | "mouse_rmb_move_y"
    | "mouse_mmb_move_x"
    | "mouse_mmb_move_y"
    | "mouse_navigate"
    | "mouse_navigate"
    | "mouse_wheel"
    | "touch_1_move_x"
    | "touch_1_move_y"
    | "touch_2_move_x"
    | "touch_2_move_y"
    | "touch_3_move_x"
    | "touch_3_move_y"
    | "touch_pinch2"
    | "touch_pinch3"
    ;

export type ControllerAxes = { [P in ControllerAxesName]: number };

export interface ContollerInputContext {
    mouseButtonChanged(event: MouseEvent): Promise<void> | void;
    touchChanged(event: TouchEvent): Promise<void> | void;
    moveBegin(event: TouchEvent | MouseEvent): Promise<void> | void
}

