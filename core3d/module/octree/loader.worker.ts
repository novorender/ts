import { LoaderHandler, type MessageResponse } from "./loader_handler";
import type { MessageRequest } from "./loader_handler";

const handler = new LoaderHandler((msg: MessageResponse, transfer?: Transferable[]) => {
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
