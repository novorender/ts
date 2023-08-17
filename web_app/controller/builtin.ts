import type { PickContext } from "./base";
import { FlightController, CadMiddlePanController, CadRightPanController, SpecialFlightController } from "./flight";
import type { ControllerInput } from "./input";
import { NullController } from "./null";
import { OrbitController } from "./orbit";
import { OrthoController } from "./ortho";
import { PanoramaController } from "./panorama";

/**
 * Return the built-in camera controllers.
 * @param input The control input.
 * @param pick The control pick context, typically the view in where
 */
export function builtinControllers(input: ControllerInput, pick: PickContext) {
    return {
        orbit: new OrbitController(input),
        flight: new FlightController(input, pick),
        ortho: new OrthoController(input),
        panorama: new PanoramaController(input),
        cadMiddlePan: new CadMiddlePanController(input, pick),
        cadRightPan: new CadRightPanController(input, pick),
        special: new SpecialFlightController(input, pick),
        null: new NullController(input),
    } as const;
}

/** Types of built-in camera controller.
 * @category Camera Controller
 * @category Render View
 */
export type BuiltinCameraControllerType = ReturnType<typeof builtinControllers>;

/** Kind strings of built-in camera controller.
 * @category Camera Controller
 * @category Render View
 */
export type BuiltinCameraControllerKind = keyof BuiltinCameraControllerType;

