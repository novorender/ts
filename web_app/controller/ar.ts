import type { RenderStateCamera } from "core3d";
import type { ReadonlyVec3 } from "gl-matrix";
import { BaseController, type ControllerInitParams } from "./base";
import type { ControllerInput } from "./input";

export class ArController extends BaseController {
    override kind = "ar" as const;
    override projection = "pinhole" as const;

    private _scale = 100;
    private _pivot: ReadonlyVec3 | undefined;

    constructor(input: ControllerInput) {
        super(input);
    }

    serialize(includeDerived?: boolean): ControllerInitParams {
        const { kind, _pivot } = this;
        return { kind, pivot: _pivot };
    }

    init(params: ControllerInitParams): void {
        this._pivot = params.pivot;
    }

    autoFit(center: ReadonlyVec3, radius: number): void {
        throw new Error("Method not implemented.");
    }
    
    update(): void {
        
    }

    stateChanges(state?: RenderStateCamera): Partial<RenderStateCamera> {
        throw new Error("Method not implemented.");
    }
}

