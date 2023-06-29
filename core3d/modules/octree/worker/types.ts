import { type NodeData, type NodeGeometry } from "./parser";

// request messages (main->worker)

export interface BufferMessage {
    readonly kind: "buffer";
    readonly buffer: SharedArrayBuffer;
}

export interface LoadMessage {
    readonly kind: "load";
    readonly id: string;
    readonly version: string;
    readonly url: string;
    readonly byteSize: number;
    readonly separatePositionsBuffer: boolean;
    readonly enableOutlines: boolean;
    readonly applyFilter: boolean;
}

export interface AbortMessage {
    readonly kind: "abort";
    readonly id: string;
}

export interface AbortAllMessage {
    readonly kind: "abort_all";

}
export interface AbortedAllMessage {
    readonly kind: "aborted_all";
}

export interface CloseMessage {
    readonly kind: "close";
}

// response messages (worker->main)

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

export type MessageRequest = BufferMessage | LoadMessage | AbortMessage | AbortAllMessage | CloseMessage;
export type MessageResponse = LoadedMessage | AbortedMessage | AbortedAllMessage | ErrorMessage;
