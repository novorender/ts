///@ts-ignore
import createWorker, { AbortAllMessage, AbortMessage, CloseMessage, LoadMessage, MessageResponse, NodePayload } from "./loader.worker.js";
import { OctreeNode } from "./node.js";

type PromiseMethods = { readonly resolve: (value: NodePayload | undefined) => void, readonly reject: (reason: string) => void };

export class NodeLoader {
    readonly worker: Worker;
    readonly promises = new Map<string, PromiseMethods>();

    constructor() {
        const downloadWorker = this.worker = createWorker() as Worker;
        downloadWorker.onmessage = e => {
            const msg = e.data as MessageResponse;
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
    }

    abortAll() {
        this.worker.postMessage({ kind: "abort_all" } satisfies AbortAllMessage);
    }

    dispose() {
        this.worker.postMessage({ kind: "close" } satisfies CloseMessage);
    }

    async loadNode(node: OctreeNode, version: string): Promise<NodePayload | undefined> {
        const { worker, promises } = this;
        const { id, data } = node;
        const url = new URL(node.path, node.context.downloader.baseUrl).toString();
        const { byteSize } = data;
        worker.postMessage({ kind: "load", id, version, url, byteSize, separatePositionsBuffer: false } satisfies LoadMessage);
        node.download = {
            abort: () => {
                worker.postMessage({ kind: "abort", id } satisfies AbortMessage);
            }
        };
        return new Promise<NodePayload | undefined>((resolve, reject) => {
            promises.set(id, { resolve, reject });
        });
    }

}


