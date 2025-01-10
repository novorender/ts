import type { AbortAllMessage, AbortMessage, InitMessage, CloseMessage, LoadMessage, MessageRequest, MessageResponse, NodePayload, ParseMessage, ParseConfig } from "./worker";
import { OctreeNode } from "./node.js";
import type { DeviceProfile } from "core3d/device.js";

interface PayloadPromiseMethods { readonly resolve: (value: NodePayload | undefined) => void, readonly reject: (reason: string) => void };

/** @internal */
export class NodeLoader {
    readonly payloadPromises = new Map<string, PayloadPromiseMethods>();
    abortAllPromise: Promise<void> = Promise.resolve();
    private resolveAbortAll: (() => void) | undefined;
    bufferPromise: Promise<void> = Promise.resolve();
    private resolveBuffer: (() => void) | undefined;
    aborted = false;

    constructor(readonly worker: Worker) {
        worker.onmessage = e => {
            this.receive(e.data as MessageResponse);
        }
    }

    async init(buffer: SharedArrayBuffer, wasmData: ArrayBuffer) {
        this.bufferPromise = new Promise<void>((resolve) => {
            this.resolveBuffer = resolve;
        })
        const msg: InitMessage = { kind: "init", buffer, wasmData };
        this.send(msg);
        await this.bufferPromise;
    }

    get activeDownloads() {
        return this.payloadPromises.size;
    }

    private send(msg: MessageRequest) {
        this.worker.postMessage(msg);
    }

    private receive(msg: MessageResponse) {
        if (msg.kind == "buffer") {
            const { resolveBuffer } = this;
            this.resolveBuffer = undefined;
            resolveBuffer?.();
            return;
        }
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
                case "ready":
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

    parseNode(buffer: ArrayBuffer, id: string, deviceProfile: DeviceProfile, config: ParseConfig): Promise<NodePayload | undefined> {
        const { payloadPromises } = this;
        const enableOutlines = deviceProfile.features.outline;
        const applyFilter = true;
        const parseMsg: ParseMessage = { kind: "parse", buffer, id, config, enableOutlines, applyFilter };
        const promise = new Promise<NodePayload | undefined>((resolve, reject) => {
            payloadPromises.set(id, { resolve, reject });
        });
        this.send(parseMsg);
        return promise;
    }

    loadNode(node: OctreeNode, config: ParseConfig): Promise<NodePayload | undefined> {
        const { payloadPromises } = this;
        const { deviceProfile } = node.context.renderContext;
        const { id, data } = node;
        if (node.context.url == undefined) {
            return Promise.resolve(undefined);
        }
        const url = new URL(node.context.url);
        url.pathname += "webgl2_bin/" + node.path;
        const { byteSize } = data;
        const enableOutlines = deviceProfile.features.outline;
        const applyFilter = true;
        const loadMsg: LoadMessage = { kind: "load", id, config, url: url.toString(), byteSize, enableOutlines, applyFilter };
        console.assert(byteSize != 0);
        const abortMsg: AbortMessage = { kind: "abort", id };
        const abort = () => {
            node.context.renderContext.setSceneResolved(this.payloadPromises.size == 1);
            this.send(abortMsg);
        }
        node.download = { abort };
        this.send(loadMsg);
        return new Promise<NodePayload | undefined>((resolve, reject) => {
            payloadPromises.set(id, { resolve, reject });
        });
    }
}
