import { AbortableDownload, Downloader } from "./download";
import { parseNode, type NodeData, type NodeGeometry } from "./parser";

// request messages (main->worker)

export interface LoadMessage {
    readonly kind: "load";
    readonly id: string;
    readonly version: string;
    readonly url: string;
    readonly byteSize: number;
    readonly separatePositionsBuffer: boolean;
}

export interface AbortMessage {
    readonly kind: "abort";
    readonly id: string;
}

export interface AbortAllMessage {
    readonly kind: "abort_all";
}

export interface CloseMessage {
    readonly kind: "close";
}

export interface FilteredMessage {
    readonly kind: "filtered"
    readonly id: string;
    readonly objectIds: Uint32Array;
}

// response messages (worker->main)

export interface FilterMessage {
    readonly kind: "filter"
    readonly id: string;
    readonly objectIds: Uint32Array;
}

export interface NodePayload {
    readonly childInfos: readonly NodeData[];
    readonly geometry: NodeGeometry;
}

export interface LoadedMessage extends NodePayload {
    readonly kind: "loaded";
    readonly id: string;
}

export interface AbortedMessage {
    readonly kind: "aborted";
    readonly id: string;
}

export interface ErrorMessage {
    readonly kind: "error";
    readonly id: string;
    readonly error: any;
}

export type MessageRequest = LoadMessage | AbortMessage | AbortAllMessage | CloseMessage | FilteredMessage;
export type MessageResponse = FilterMessage | LoadedMessage | AbortedMessage | ErrorMessage;

export interface HandlerReturn {
    readonly response: MessageResponse;
    readonly transfer: Transferable[];
};

interface FilterPromiseMethods { readonly resolve: (value: Uint32Array | undefined) => void, readonly reject: (reason: string) => void };

export class LoaderHandler {
    readonly downloader = new Downloader();
    readonly downloads = new Map<string, AbortableDownload>();
    readonly filterPromises = new Map<string, FilterPromiseMethods>();

    constructor(readonly send: (msg: MessageResponse, transfer?: Transferable[]) => void) {
    }

    receive(msg: MessageRequest) {
        switch (msg.kind) {
            case "load":
                this.load(msg);
                break;
            case "filtered":
                this.filtered(msg);
                break;
            case "abort":
                this.abort(msg);
                break;
            case "abort_all":
                this.abortAll(msg);
                break;
            default:
                console.error(`Uknown load message: ${msg}!`);
                break;
        }
    }

    private async requestFilter(id: string, objectIds: Uint32Array) {
        const { filterPromises } = this;
        const promise = new Promise<Uint32Array | undefined>((resolve, reject) => {
            filterPromises.set(id, { resolve, reject });
        });
        const filterMsg: FilterMessage = { kind: "filter", id, objectIds };
        this.send(filterMsg);
        return promise;
    }

    private filtered(params: FilteredMessage) {
        const { id, objectIds } = params;
        const { filterPromises } = this;
        const filterPromise = filterPromises.get(id);
        if (filterPromise) {
            filterPromises.delete(id);
            filterPromise.resolve(objectIds);
        }
    }

    private async load(params: LoadMessage) {
        const { downloader, downloads } = this;
        const { url, id, version, byteSize, separatePositionsBuffer } = params;
        try {
            const download = downloader.downloadArrayBufferAbortable(url, new ArrayBuffer(byteSize));
            downloads.set(id, download);
            const buffer = await download.result;
            if (buffer) {
                downloads.delete(id);
                // const filterObjectIds = (objectIds: Uint32Array) => (Promise.resolve(objectIds));
                const filterObjectIds = (objectIds: Uint32Array) => (this.requestFilter(id, objectIds));
                const { childInfos, geometry } = await parseNode(id, separatePositionsBuffer, version, buffer, filterObjectIds);
                const loadedMsg: LoadedMessage = { kind: "loaded", id, childInfos, geometry };
                const transfer: Transferable[] = [];
                for (const { vertexBuffers, indices } of geometry.subMeshes) {
                    transfer.push(...vertexBuffers);
                    if (typeof indices != "number") {
                        transfer.push(indices.buffer);
                    }
                }
                this.send(loadedMsg, transfer);
            }
        } catch (error) {
            this.error(id, error);
        }
    }

    private removeNode(id: string) {
        const { downloads, filterPromises } = this;
        const download = downloads.get(id);
        downloads.delete(id);
        const filterPromise = filterPromises.get(id);
        filterPromises.delete(id);
        return { download, filterPromise };
    }

    private error(id: string, error: any) {
        const { download, filterPromise } = this.removeNode(id);
        const errorMsg = { kind: "error", id, error } as ErrorMessage;
        this.send(errorMsg);
    }

    private abort(params: AbortMessage) {
        const { id } = params;
        const { download, filterPromise } = this.removeNode(id);
        download?.abort();
        filterPromise?.resolve(undefined);
    }

    private abortAll(params: AbortAllMessage) {
        const { downloader, downloads, filterPromises } = this;
        for (const download of downloads.values()) {
            download.abort();
        }
        for (const filterPromise of filterPromises.values()) {
            filterPromise.resolve(undefined);
        }
        downloads.clear();
        filterPromises.clear();
        downloader.abort();
    }
}