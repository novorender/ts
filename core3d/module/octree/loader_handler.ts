import { AbortableDownload, Downloader } from "./download";
import { parseNode, NodeData, NodeGeometry } from "./parser";

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

export type MessageRequest = LoadMessage | AbortMessage | AbortAllMessage | CloseMessage;
export type MessageResponse = LoadedMessage | AbortedMessage | ErrorMessage;

export interface HandlerReturn {
    readonly response: MessageResponse;
    readonly transfer: Transferable[];
};

export class LoaderHandler {
    readonly downloader = new Downloader();
    readonly downloads = new Map<string, AbortableDownload>();

    handleMessage(msg: MessageRequest): Promise<HandlerReturn> | undefined {
        let response: Promise<HandlerReturn> | undefined;
        switch (msg.kind) {
            case "load":
                response = this.load(msg);
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
        return response;
    }

    private async load(params: LoadMessage): Promise<HandlerReturn> {
        const { downloader, downloads } = this;
        const { url, id, version, byteSize, separatePositionsBuffer } = params;
        let response: MessageResponse = { kind: "aborted", id } as const satisfies AbortedMessage;
        const transfer: Transferable[] = [];
        try {
            const download = downloader.downloadArrayBufferAbortable(url, new ArrayBuffer(byteSize));
            downloads.set(id, download);
            const buffer = await download.result;
            if (buffer) {
                downloads.delete(id);
                const { childInfos, geometry } = parseNode(id, separatePositionsBuffer, version, buffer);
                response = { kind: "loaded", id, childInfos, geometry } as const satisfies LoadedMessage;
                for (const { vertexBuffer, indices, positionBuffer } of geometry.subMeshes) {
                    transfer.push(vertexBuffer);
                    if (typeof indices != "number") {
                        transfer.push(indices.buffer);
                    }
                    if (positionBuffer) {
                        transfer.push(positionBuffer);
                    }
                }
            }
        } catch (error) {
            response = { kind: "error", id, error } as const satisfies ErrorMessage;
        }
        return { response, transfer };
    }

    private abort(params: AbortMessage) {
        const { downloader, downloads } = this;
        const { id } = params;
        const download = downloads.get(id);
        downloads.delete(id);
        download?.abort();
    }

    private abortAll(params: AbortAllMessage) {
        const { downloader, downloads } = this;
        for (const download of downloads.values()) {
            download.abort();
        }
        downloader.abort();
        downloads.clear();
    }
}