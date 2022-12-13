///@ts-ignore
import createWorker from "./loader.worker.js"; // uses esbuild-plugin-inline-worker to inline worker code.
import { AbortAllMessage, AbortMessage, CloseMessage, LoaderHandler, LoadMessage, MessageResponse, NodePayload } from "./loader_handler";
import { OctreeNode } from "./node.js";

type PromiseMethods = { readonly resolve: (value: NodePayload | undefined) => void, readonly reject: (reason: string) => void };

export class NodeLoader {
    readonly worker: Worker | undefined;
    readonly handler = new LoaderHandler();
    readonly promises = new Map<string, PromiseMethods>();

    constructor(options: { readonly useWorker: boolean }) {
        if (options.useWorker) {
            const worker = this.worker = createWorker() as Worker;
            worker.onmessage = e => {
                this.handleResponse(e.data as MessageResponse);
            }
        }
    }

    private handleResponse(msg: MessageResponse) {
        const { id } = msg;
        const promise = this.promises.get(id);
        if (promise) {
            this.promises.delete(id);
            const { resolve, reject } = promise;
            switch (msg.kind) {
                case "loaded":
                    resolve(msg);
                    break;
                case "aborted":
                    resolve(undefined);
                    break;
                case "error":
                    reject(msg.error);
                    break;
            }
        }
    }

    abortAll() {
        const { worker, handler } = this;
        const msg: AbortAllMessage = { kind: "abort_all" };
        if (worker) {
            worker.postMessage(msg);
        } else {
            handler.handleMessage(msg)
        }
    }

    dispose() {
        const { worker, handler } = this;
        const msg: CloseMessage = { kind: "close" };
        if (worker) {
            worker.postMessage(msg);
        } else {
            handler.handleMessage(msg);
        }
    }

    loadNode(node: OctreeNode, version: string): Promise<NodePayload | undefined> {
        const { worker, promises, handler } = this;
        const { id, data } = node;
        const url = new URL(node.path, node.context.downloader.baseUrl).toString();
        const { byteSize } = data;
        const msg: LoadMessage = { kind: "load", id, version, url, byteSize, separatePositionsBuffer: false };
        const abort: AbortMessage = { kind: "abort", id };
        if (worker) {
            node.download = {
                abort: () => { worker.postMessage(abort); }
            };
            worker.postMessage(msg);
        } else {
            node.download = {
                abort: () => { handler.handleMessage(abort); }
            };
            handler.handleMessage(msg)?.then(ret => {
                if (ret) {
                    this.handleResponse(ret.response);
                }
            });
        }
        return new Promise<NodePayload | undefined>((resolve, reject) => {
            promises.set(id, { resolve, reject });
        });
    }
}
