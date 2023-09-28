import { LoaderHandler } from "./handler";
import type { MessageResponse, MessageRequest } from "./messages";
import { esbuildWasmInstance } from "./wasm_loader";
export type * from "./parser";
export type * from "./messages";

const wasm = await esbuildWasmInstance("dist");
wasm.init();

const handler = new LoaderHandler(wasm, (msg: MessageResponse, transfer?: Transferable[]) => {
    postMessage(msg, { transfer });
});

onmessage = e => {
    const msg = e.data as MessageRequest;
    if (msg.kind == "close") {
        close();
    } else {
        handler.receive(msg);
    }
};
