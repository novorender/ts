///@ts-ignore
import createWorker from "./worker/index.worker.js"; // uses esbuild-plugin-inline-worker to inline worker code.
import type { RenderStateScene } from "core3d/state";
import { LoaderHandler, type AbortAllMessage, type AbortMessage, type BufferMessage, type CloseMessage, type LoadMessage, type MessageRequest, type MessageResponse, type NodePayload } from "./worker";
import { OctreeNode } from "./node.js";

interface PayloadPromiseMethods { readonly resolve: (value: NodePayload | undefined) => void, readonly reject: (reason: string) => void };

export interface NodeLoaderOptions {
    readonly useWorker: boolean;
}

export class NodeLoader {
    readonly worker: Worker | undefined;
    readonly handler;
    readonly payloadPromises = new Map<string, PayloadPromiseMethods>();
    abortAllPromise: Promise<void> = Promise.resolve();
    private resolveAbortAll: (() => void) | undefined;
    aborted = false;

    constructor(options: NodeLoaderOptions) {
        if (options.useWorker) {
            const worker = this.worker = createWorker() as Worker;
            worker.onmessage = e => {
                this.receive(e.data as MessageResponse);
            }
        }
        this.handler = new LoaderHandler(this.receive.bind(this));
    }

    setBuffer(buffer: SharedArrayBuffer) {
        const msg: BufferMessage = { kind: "buffer", buffer };
        this.send(msg);
    }

    get activeDownloads() {
        return this.payloadPromises.size;
    }

    private send(msg: MessageRequest) {
        const { worker, handler } = this;
        if (worker) {
            worker.postMessage(msg);
        } else {
            handler.receive(msg);
        }
    }

    private receive(msg: MessageResponse) {
        if (msg.kind == "aborted_all") {
            const { resolveAbortAll } = this;
            this.resolveAbortAll = undefined;
            resolveAbortAll?.();
            return;
        }
        const { id } = msg;
        const { payloadPromises } = this;
        const payloadPromise = payloadPromises.get(id);
        if (payloadPromise) {
            payloadPromises.delete(id);
            const { resolve, reject } = payloadPromise;
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
        this.abortAllPromise = new Promise<void>((resolve) => {
            this.resolveAbortAll = resolve;
        })
        const msg: AbortAllMessage = { kind: "abort_all" };
        this.send(msg);
        this.payloadPromises.clear();
    }

    dispose() {
        const msg: CloseMessage = { kind: "close" };
        this.send(msg);
    }

    loadNode(node: OctreeNode, version: string): Promise<NodePayload | undefined> {
        const { payloadPromises } = this;
        const { deviceProfile } = node.context.renderContext;
        const { id, data } = node;
        if (node.context.url == undefined) {
            return Promise.resolve(undefined);
        }
        const url = new URL(node.context.url);
        url.pathname += node.path;
        const { byteSize } = data;
        const enableOutlines = deviceProfile.features.outline;
        const applyFilter = true;
        const loadMsg: LoadMessage = { kind: "load", id, version, url: url.toString(), byteSize, separatePositionsBuffer: true, enableOutlines, applyFilter };
        console.assert(byteSize != 0);
        const abortMsg: AbortMessage = { kind: "abort", id };
        const abort = () => { this.send(abortMsg); }
        node.download = { abort };
        this.send(loadMsg);
        return new Promise<NodePayload | undefined>((resolve, reject) => {
            payloadPromises.set(id, { resolve, reject });
        });
    }
}
