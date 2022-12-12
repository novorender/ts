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

type MessageRequest = LoadMessage | AbortMessage | AbortAllMessage | CloseMessage;
export type MessageResponse = LoadedMessage | AbortedMessage | ErrorMessage;

onmessage = e => {
    const msg = e.data as MessageRequest;
    switch (msg.kind) {
        case "load":
            load(msg);
            break;
        case "abort":
            abort(msg);
            break;
        case "abort_all":
            abortAll(msg);
            break;
        case "close":
            close();
            break;
        default:
            console.error(`Uknown load message: ${msg}!`);
            break;
    }
};

const downloader = new Downloader();
const downloads = new Map<string, AbortableDownload>();

async function load(params: LoadMessage) {
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
    postMessage(response, { transfer });
}

function abort(params: AbortMessage) {
    const { id } = params;
    const download = downloads.get(id);
    downloads.delete(id);
    download?.abort();
}

function abortAll(params: AbortAllMessage) {
    for (const download of downloads.values()) {
        download.abort();
    }
    downloads.clear();
}