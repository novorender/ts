
import { type ReadonlyVec3, quat, type ReadonlyQuat } from "gl-matrix";
import { BaseController, type ControllerInitParams, type MutableCameraState } from "./base";
import { type RenderStateCamera, } from "core3d";
import { ControllerInput } from "./input";

/** Null type camera motion controller.
 * @remarks
 * This controller is completely passive and will not overwrite/modify any camera render state.
 * @category Camera Controllers
 */
export class NullController extends BaseController {
    override kind = "null" as const;
    override projection = undefined;
    override changed = false;

    /**
     * @param input The input source.
     */
    constructor(input: ControllerInput) {
        super(input);
    }

    override serialize(): ControllerInitParams {
        const { kind } = this;
        return { kind };
    }

    override init(params: ControllerInitParams) {
        const { kind } = params;
        console.assert(kind == this.kind);
        this.input.usePointerLock = false;
        this.attach();
    }

    override autoFit(center: ReadonlyVec3, radius: number): void {
    }

    override update(): void {
    }

    override stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        return {};
    }

    /** NullController type guard function.
     * @param controller The controller to type guard.
     */
    static is(controller: BaseController): controller is NullController {
        return controller instanceof NullController;
    }

    /** NullController type assert function.
     * @param controller The controller to type assert.
     */
    static assert(controller: BaseController): asserts controller is NullController {
        if (!(controller instanceof NullController))
            throw new Error("Camera controller is not of type NullController!");
    }
}
