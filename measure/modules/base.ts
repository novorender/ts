import { MeasureView, type MeasureWorker } from "../measure_view";

export class BaseModule {
    constructor(readonly worker: MeasureWorker, readonly parent: MeasureView) { }
}
