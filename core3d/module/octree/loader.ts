///@ts-ignore
import createWorker from "./loader.worker.js"; // uses esbuild-plugin-inline-worker to inline worker code.
import type { RenderStateScene } from "core3d/state";
import { AbortAllMessage, AbortMessage, CloseMessage, FilteredMessage, FilterMessage, LoaderHandler, LoadMessage, MessageRequest, MessageResponse, NodePayload } from "./loader_handler";
import { OctreeNode } from "./node.js";
import { filterSortedExclude, filterSortedInclude } from "core3d/iterate.js";

interface PayloadPromiseMethods { readonly resolve: (value: NodePayload | undefined) => void, readonly reject: (reason: string) => void };

export interface NodeLoaderOptions {
    readonly useWorker: boolean;
}

export class NodeLoader {
    readonly worker: Worker | undefined;
    readonly handler;
    readonly payloadPromises = new Map<string, PayloadPromiseMethods>();
    private state: RenderStateScene | undefined;

    constructor(options: NodeLoaderOptions) {
        if (options.useWorker) {
            const worker = this.worker = createWorker() as Worker;
            worker.onmessage = e => {
                this.receive(e.data as MessageResponse);
            }
        }
        this.handler = new LoaderHandler(this.receive.bind(this));
    }

    init(state: RenderStateScene | undefined) {
        if (this.state && state != this.state) {
            this.abortAll();
        }
        this.state = state;
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
        const { id } = msg;
        switch (msg.kind) {
            case "filter":
                this.filter(msg);
                return;
        }

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
        const msg: AbortAllMessage = { kind: "abort_all" };
        this.send(msg);
    }

    dispose() {
        const msg: CloseMessage = { kind: "close" };
        this.send(msg);
    }

    loadNode(node: OctreeNode, version: string): Promise<NodePayload | undefined> {
        const { payloadPromises } = this;
        const { id, data } = node;
        const url = new URL(node.path, node.context.downloader.baseUrl).toString();
        const { byteSize } = data;
        const loadMsg: LoadMessage = { kind: "load", id, version, url, byteSize, separatePositionsBuffer: false };
        console.assert(byteSize != 0);
        const abortMsg: AbortMessage = { kind: "abort", id };
        const abort = () => { this.send(abortMsg); }
        node.download = { abort };
        this.send(loadMsg);
        return new Promise<NodePayload | undefined>((resolve, reject) => {
            payloadPromises.set(id, { resolve, reject });
        });
    }

    filter(filterMsg: FilterMessage) {
        const { id } = filterMsg;
        let { objectIds } = filterMsg;
        const { state } = this;
        if (state) {
            const { filter } = state;
            if (filter) {
                const filterFunc = filter.mode == "include" ? filterSortedInclude : filterSortedExclude;
                objectIds = new Uint32Array([...(filterFunc(objectIds, filter.objectIds))]);
            }
        }
        const filteredMsg: FilteredMessage = { kind: "filtered", id, objectIds };
        this.send(filteredMsg);
    }
}
