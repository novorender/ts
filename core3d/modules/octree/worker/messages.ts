import { type NodeData, type NodeGeometry } from "./parser";

// request messages (main->worker)

export interface BufferMessage {
    readonly kind: "buffer";
    readonly buffer: SharedArrayBuffer;
}

export interface ParseParams {
    readonly id: string;
    readonly version: string;
    readonly separatePositionsBuffer: boolean;
    readonly enableOutlines: boolean;
    readonly applyFilter: boolean;
}

export interface ParseMessage extends ParseParams {
    readonly kind: "parse";
    readonly buffer: ArrayBuffer;
}

export interface LoadMessage extends ParseParams {
    readonly kind: "load";
    readonly url: string;
    readonly byteSize: number;
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

export interface ReadyMessage extends NodePayload {
    readonly kind: "ready";
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

export type MessageRequest = BufferMessage | ParseMessage | LoadMessage | AbortMessage | AbortAllMessage | CloseMessage;
export type MessageResponse = ReadyMessage | AbortedMessage | AbortedAllMessage | ErrorMessage;
