import * as Comlink from "comlink";
import { MeasureTool } from "./scene";

class Service {
    scriptUrl: string | undefined;

    initialize(scriptUrl: string) {
        this.scriptUrl = scriptUrl;
    }

    terminate() {
        if ("DedicatedWorkerGlobalScope" in self) {
            self.close();
        }
    }

    createMeasureTool() {
        const tool = new MeasureTool();
        return Comlink.proxy(tool);
    }
}

const service = new Service();
Comlink.expose(service);

export type { Service };
