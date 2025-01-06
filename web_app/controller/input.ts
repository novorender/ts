import { vec2, type ReadonlyVec2 } from "gl-matrix";

/**
 * The input source of camera controllers.
 * @remarks
 * This class abstract away input gestures, such as mouse, keyboard and touch event into a unified model.
 * It does this by defining a {@link ControllerAxes | set of axes} that represents an imagined gamepad/joystick input device for each class of input gestures.
 * The assumption is that each of these axes may be bound to a pair of keyboard keys, e.g. `A` and `D`, or some input position coordinate, e.g. the mouse `x` position for left/right motion.
 * All of these axes are updated independently, i.e. it is possible to move a camera with both keyboard and mouse simultaneously.
 * It is up to each camera controller to scale and apply each of these axes into an actual motion of the camera.
 * @category Camera Controllers
 */
export class ControllerInput {
    /** The underlying HTMLElement providing input events. */
    readonly domElement;

    /** A set of optional callbacks for controllers that wants to handle certain input events themselves. */
    callbacks: ContollerInputContext | undefined;

    /** The current values of each input axis. */
    readonly axes: ControllerAxes;

    /** The current list of individual touch contact points. */
    touchPoints: readonly TouchContactPoint[] = [];

    private readonly _keys = new Set<string>();
    private _mouseButtonDown = false;
    private _zoomY = 0;
    private _zoomX = 0;
    private readonly _prevTouchCenter = [0, 0] as vec2;
    private _touchZoomDistancePrev = 0;
    private _mouseDownClientPos = vec2.create();
    private _mouseMoveStarted = false;
    private _pointerLocked = false;

    private _mouseWheelLastActive = 0;
    private static readonly _gestureKeys = ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

    /** Whether to use {@link https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API | mouse pointer lock} or not. */
    usePointerLock = true;

    /** Consider mouse started moving after mouse passed this distance. Default is 0 */
    mouseMoveSensitivity = 0;
    
    /** Ignore wheel events when shift is pressed. Default is false */
    disableWheelOnShift = false;

    /**
     * @param domElement The HTMLElement to subscribe to input events from.
     */
    constructor(domElement?: HTMLElement) {
        this.domElement = domElement ?? document.body;
        this.connect();
        this.axes = {} as ControllerAxes;
        this.resetAxes();
    }

    /** Unsubscribe from input events. */
    dispose() {
        this.disconnect();
    }

    /** Return the client width of the input {@link domElement}. */
    get width() {
        return this.domElement.clientWidth;
    }

    /** Return the client height of the input {@link domElement}. */
    get height() {
        return this.domElement.clientHeight;
    }

    /** Current multiplier applied to motion via the Control/Alt keys. */
    get multiplier() {
        const { _keys } = this;
        let m = 1;
        if (_keys.has("Shift")) m *= 10;
        if (_keys.has("Control")) m *= 10;
        if (_keys.has("Alt")) m *= 0.1;
        return m;
    }

    /** Whether the shift key is currently pressed or not. */
    get hasShift() {
        const { _keys } = this;
        if (_keys.has("Shift")) return true;
        return false;
    }

    /** The pixel position centering zoom gestures.
     * @remarks
     * This is typically the current cursor position while using the mouse scroll wheel,
     * or the center position between touch points in a pinch gesture.
     */
    get zoomPos() {
        const { width, height, _zoomX, _zoomY } = this;
        if (_zoomX == 0 && _zoomY == 0) {
            return [0, 0];
        }
        return [-(_zoomX - width / 2) / height * 2, (_zoomY - height / 2) / height * 2];
    }

    /** Subscribe to input events from {@link domElement}. */
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
        window.addEventListener("mousemove", this.mousemove, options);
        domElement.addEventListener("wheel", this.wheel, options);
        domElement.addEventListener("touchstart", this.touchstart, options);
        domElement.addEventListener("touchmove", this.touchmove, options);
        domElement.addEventListener("touchend", this.touchend, options);
        domElement.addEventListener("touchcancel", this.touchcancel, options);
        domElement.focus();
    }

    /** Unsubscribe to input events from {@link domElement}. */
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
        window.removeEventListener("mousemove", this.mousemove, options);
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

    /** Indicate whether the mouse scroll wheel has recently been moved. */
    public isScrolling() {
        return (performance.now() - this._mouseWheelLastActive) < 100
    }

    private updateModifierKeys(e: ModiferKeyEvent) {
        const { _keys } = this;
        e.altKey ? _keys.add("Alt") : _keys.delete("Alt");
        e.shiftKey ? _keys.add("Shift") : _keys.delete("Shift");
        e.ctrlKey ? _keys.add("Control") : _keys.delete("Control");
    }

    private keydown = (e: KeyboardEvent) => {
        if (ControllerInput.isGestureKey(e.code)) {
            e.preventDefault();
        }
        this.updateModifierKeys(e);
        this._keys.add(e.code);
        this._zoomX = 0;
        this._zoomY = 0;
    };

    private keyup = (e: KeyboardEvent) => {
        if (ControllerInput.isGestureKey(e.code)) {
            e.preventDefault();
        }
        this.updateModifierKeys(e);
        this._keys.delete(e.code);
    };

    private blur = (e: FocusEvent) => {
        if ("exitPointerLock" in document) document.exitPointerLock();
        this._keys.clear();
    };

    private mousedown = async (e: MouseEvent) => {
        const { domElement, axes } = this;
        vec2.set(this._mouseDownClientPos, e.clientX, e.clientY);
        if (this.mouseMoveSensitivity <= 0) {
            this._mouseMoveStarted = true;
        }
        this._mouseButtonDown = true;
        this._pointerLocked = false;
        domElement.focus();
        e.preventDefault();
        this.updateModifierKeys(e);
        this.callbacks?.mouseButtonChanged?.(e);
        await this.callbacks?.moveBegin?.(e);
        if (e.buttons & MouseButtons.forward) {
            axes.mouse_navigate--;
        } else if (e.buttons & MouseButtons.backward) {
            axes.mouse_navigate++;
        }
    };

    private mouseup = async (e: MouseEvent) => {
        e.preventDefault();
        this.updateModifierKeys(e);
        if ("exitPointerLock" in document) document.exitPointerLock();
        this.callbacks?.mouseButtonChanged?.(e);
        this._mouseButtonDown = false;
        this._mouseMoveStarted = false;
        this._pointerLocked = false;
    };

    private wheel = async (e: WheelEvent) => {
        const { axes } = this;
        this.updateModifierKeys(e);
        if (this.disableWheelOnShift && this.hasShift) return;
        this._zoomX = e.offsetX;
        this._zoomY = e.offsetY;
        await this.callbacks?.moveBegin?.(e);
        this._mouseWheelLastActive = performance.now();
        axes.mouse_wheel += e.deltaY;
    };

    private mousemove = (e: MouseEvent) => {
        if (!this._mouseButtonDown) return;
        this.updateModifierKeys(e);
        if (!this._mouseMoveStarted) {
            const dist = vec2.dist(this._mouseDownClientPos, vec2.fromValues(e.clientX, e.clientY));
            if (dist >= this.mouseMoveSensitivity) {
                this._mouseMoveStarted = true;
                this._mouseButtonDown = true;
            } else {
                return;
            }
        }
        if (!this._pointerLocked && this.usePointerLock) {
            this.domElement.requestPointerLock();
            this._pointerLocked = true;
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

    private getTouchData = (touch: Touch) => {
        const { x, y } = getLocalTouchCoords(touch);
        return { id: touch.identifier, x: Math.round(x), y: Math.round(y) };
    }

    private touchstart = async (event: TouchEvent) => {
        this.touchPoints = Array.from(event.touches).map(this.getTouchData);
        const { touchPoints, _prevTouchCenter } = this;
        this.callbacks?.touchChanged?.(event);

        switch (touchPoints.length) {
            case 1:
                _prevTouchCenter[0] = touchPoints[0].x;
                _prevTouchCenter[1] = touchPoints[0].y;
                break;
            default: // 2 or more
                const dx = touchPoints[0].x - touchPoints[1].x;
                const dy = touchPoints[0].y - touchPoints[1].y;
                this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);
                _prevTouchCenter[0] = (touchPoints[0].x + touchPoints[1].x) / 2;
                _prevTouchCenter[1] = (touchPoints[0].y + touchPoints[1].y) / 2;
                break;
        }
        await this.callbacks?.moveBegin?.(event);
    };

    private touchend = async (event: TouchEvent) => {
        this.touchPoints = Array.from(event.touches).map(this.getTouchData);
        const { touchPoints, _prevTouchCenter } = this;
        this.callbacks?.touchChanged?.(event);
        switch (touchPoints.length) {
            case 0:
                break;
            case 1:
                _prevTouchCenter[0] = touchPoints[0].x;
                _prevTouchCenter[1] = touchPoints[0].y;
                break;
            default:
                const dx = touchPoints[0].x - touchPoints[1].x;
                const dy = touchPoints[0].y - touchPoints[1].y;
                this._touchZoomDistancePrev = Math.sqrt(dx * dx + dy * dy);
                _prevTouchCenter[0] = (touchPoints[0].x + touchPoints[1].x) / 2;
                _prevTouchCenter[1] = (touchPoints[0].y + touchPoints[1].y) / 2;
                break;
        }
    };

    private touchcancel = (event: TouchEvent) => {
        event.preventDefault();
        this.touchPoints = Array.from(event.touches).map(this.getTouchData);
    };

    private touchmove = (event: TouchEvent) => {
        if (event.cancelable) event.preventDefault();
        const prevTouchPoints = this.touchPoints;
        this.touchPoints = Array.from(event.touches).map(this.getTouchData);
        const { touchPoints, _prevTouchCenter } = this;
        let { x, y } = touchPoints[0];

        const { axes } = this;
        if (touchPoints.length > 1) {
            const dx = touchPoints[0].x - touchPoints[1].x;
            const dy = touchPoints[0].y - touchPoints[1].y;
            const touchZoomDistance = Math.sqrt(dx * dx + dy * dy);

            x = (touchPoints[0].x + touchPoints[1].x) / 2;
            y = (touchPoints[0].y + touchPoints[1].y) / 2;

            const touchCenter = vec2.fromValues(x, y);
            const dist = vec2.dist(_prevTouchCenter, touchCenter);

            const deltaWheel = this._touchZoomDistancePrev - touchZoomDistance; // / this.domElement.clientHeight;
            this._touchZoomDistancePrev = touchZoomDistance;
            this._zoomX = x;
            this._zoomY = y;
            if (dist * 2 < Math.abs(deltaWheel)) {
                if (touchPoints.length == 2) {
                    axes.touch_pinch2 += deltaWheel;
                } else {
                    axes.touch_pinch3 += deltaWheel;
                }
            }
            else if (prevTouchPoints.length == 2 && touchPoints.length == 2) {
                const a1 = prevTouchPoints[0].x - _prevTouchCenter[0];
                const b1 = prevTouchPoints[0].y - _prevTouchCenter[1];
                const c1 = touchPoints[0].x - touchCenter[0];
                const d1 = touchPoints[0].y - touchCenter[1];

                const a2 = prevTouchPoints[1].x - _prevTouchCenter[0];
                const b2 = prevTouchPoints[1].y - _prevTouchCenter[1];
                const c2 = touchPoints[1].x - touchCenter[0];
                const d2 = touchPoints[1].y - touchCenter[1];

                let i = 0;

                const angleDiff = (a: number, b: number, c: number, d: number) => {
                    const v1 = vec2.fromValues(a, b);
                    vec2.normalize(v1, v1);
                    const v2 = vec2.fromValues(c, d);
                    vec2.normalize(v2, v2);
                    const cp = v1[0] * v2[1] - v2[0] * v1[1];
                    const dp = vec2.dot(v1, v2);
                    return Math.atan2(cp, dp);
                }
                const angle1 = angleDiff(a1, b1, c1, d1);
                const angle2 = angleDiff(a2, b2, c2, d2);
                axes.touch_2_rotate = angle1 + angle2;
            }
        }
        switch (touchPoints.length) {
            case 1:
                axes.touch_1_move_x += x - _prevTouchCenter[0];
                axes.touch_1_move_y += y - _prevTouchCenter[1];
                break;
            case 2:
                axes.touch_2_move_x += x - _prevTouchCenter[0];
                axes.touch_2_move_y += y - _prevTouchCenter[1];
                break;
            case 3:
                axes.touch_3_move_x += x - _prevTouchCenter[0];
                axes.touch_3_move_y += y - _prevTouchCenter[1];
                break;
        }
        _prevTouchCenter[0] = x;
        _prevTouchCenter[1] = y;
    };

    /** Apply time-related state updates.
     * @param elapsedTime The amount of milliseconds passed since the last call to this function.
     */
    animate(elapsedTime: number) {
        const { axes, _keys } = this;
        const delta = elapsedTime * this.height / 2000;
        if (_keys.size) {
            if (_keys.has("KeyA")) axes.keyboard_ad -= delta;
            if (_keys.has("KeyD")) axes.keyboard_ad += delta;
            if (_keys.has("KeyW")) axes.keyboard_ws -= delta;
            if (_keys.has("KeyS")) axes.keyboard_ws += delta;
            if (_keys.has("KeyQ")) axes.keyboard_qe += delta;
            if (_keys.has("KeyE")) axes.keyboard_qe -= delta;
            if (_keys.has("ArrowLeft")) axes.keyboard_arrow_left_right -= delta;
            if (_keys.has("ArrowRight")) axes.keyboard_arrow_left_right = delta;;
            if (_keys.has("ArrowUp")) axes.keyboard_arrow_up_down -= delta;
            if (_keys.has("ArrowDown")) axes.keyboard_arrow_up_down += delta;
        }
    }

    /** Reset axes to their default/neutral state. */
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
        axes.touch_2_rotate = 0;
        axes.touch_3_move_x = 0;
        axes.touch_3_move_y = 0;
        axes.touch_pinch2 = 0;
        axes.touch_pinch3 = 0;
    }

    /** Determine if axes are all at their default/neutral state. */
    axesEmpty() {
        const { axes } = this;
        return axes.keyboard_ad == 0 &&
            axes.keyboard_ws == 0 &&
            axes.keyboard_qe == 0 &&
            axes.keyboard_arrow_left_right == 0 &&
            axes.keyboard_arrow_up_down == 0 &&
            axes.mouse_lmb_move_x == 0 &&
            axes.mouse_lmb_move_y == 0 &&
            axes.mouse_rmb_move_x == 0 &&
            axes.mouse_rmb_move_y == 0 &&
            axes.mouse_mmb_move_x == 0 &&
            axes.mouse_mmb_move_y == 0 &&
            axes.mouse_navigate == 0 &&
            axes.mouse_navigate == 0 &&
            axes.mouse_wheel == 0 &&
            axes.touch_1_move_x == 0 &&
            axes.touch_1_move_y == 0 &&
            axes.touch_2_move_x == 0 &&
            axes.touch_2_move_y == 0 &&
            axes.touch_3_move_x == 0 &&
            axes.touch_3_move_y == 0 &&
            axes.touch_pinch2 == 0 &&
            axes.touch_pinch3 == 0;
    }
}

/** Flags for various mouse buttons.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons}
 * @category Camera Controllers
 */
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
    | "touch_2_rotate"
    | "touch_3_move_x"
    | "touch_3_move_y"
    | "touch_pinch2"
    | "touch_pinch3"
    ;

/** The input gesture axes values.
 * @property keyboard_ad Keyboard `A` and `D` axis.
 * @property keyboard_ws Keyboard `W` and `S` axis.
 * @property keyboard_qe Keyboard `Q` and `E` axis.
 * @property keyboard_arrow_left_right Keyboard cursor left and right axis.
 * @property keyboard_arrow_up_down Keyboard cursor up and down axis.
 * @category Camera Controllers
 */
export type ControllerAxes = { [P in ControllerAxesName]: number };

/** Input event callbacks.
 * @category Camera Controllers
 */
export interface ContollerInputContext {
    /** Mouse button events. */
    mouseButtonChanged(event: MouseEvent): Promise<void> | void;
    /** Touch "click" events. */
    touchChanged(event: TouchEvent): Promise<void> | void;
    /** Mouse or touch move events. */
    moveBegin(event: TouchEvent | MouseEvent): Promise<void> | void
}

/** A single touch input contact point.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Touch} for more details.
 * @category Camera Controllers
 */
export interface TouchContactPoint {
    /** The touch identifier.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Touch/identifier}
     */
    readonly id: number;

    /** The touch client x coordinate.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Touch/clientX}
     */
    readonly x: number;

    /** The touch client y coordinate.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Touch/clientY}
     */
    readonly y: number;
}

interface ModiferKeyEvent {
    altKey: boolean,
    shiftKey: boolean,
    ctrlKey: boolean
}

// Ported from https://github.com/playcanvas/engine/blob/e1d8263d62ac3e55f2a7d24b2919eca9a2bf83ea/src/platform/input/touch-event.js#L14 (MIT)
function getLocalTouchCoords(touch: Touch) {
    let totalOffsetX = 0;
    let totalOffsetY = 0;
    let target = touch.target;
    while (!(target instanceof HTMLElement)) {
        target = (target as Node).parentNode as Node;
    }
    let currentElement = target;

    do {
        totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
        totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
        currentElement = currentElement.offsetParent as HTMLElement;
    } while (currentElement);

    return {
        x: touch.pageX - totalOffsetX,
        y: touch.pageY - totalOffsetY
    };
}