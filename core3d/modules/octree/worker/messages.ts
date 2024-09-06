import { type NodeData, type NodeGeometry } from "./parser";

// request messages (main->worker)

/** @internal */
export interface InitMessage {
    readonly kind: "init";
    readonly wasmData: ArrayBuffer;
    readonly buffer: SharedArrayBuffer;
}

/** @internal */
export interface BufferSet {
    readonly kind: "buffer";
}

/** @internal */
export interface ParseParams {
    readonly id: string;
    readonly config: ParseConfig;
    readonly enableOutlines: boolean;
    readonly applyFilter: boolean;
}

export interface ParseConfig {
    readonly version: string;
    readonly hasPointIntensity?: boolean;
    readonly hasPointClassification?: boolean;
    readonly numPointDeviations?: number;
}

/** @internal */
export interface ParseMessage extends ParseParams {
    readonly kind: "parse";
    readonly buffer: ArrayBuffer;
}

/** @internal */
export interface LoadMessage extends ParseParams {
    readonly kind: "load";
    readonly url: string;
    readonly byteSize: number;
}

/** @internal */
export interface AbortMessage {
    readonly kind: "abort";
    readonly id: string;
}

/** @internal */
export interface AbortAllMessage {
    readonly kind: "abort_all";
}

/** @internal */
export interface AbortedAllMessage {
    readonly kind: "aborted_all";
}

/** @internal */
export interface CloseMessage {
    readonly kind: "close";
}

// response messages (worker->main)

/** @internal */
export interface NodePayload {
    readonly childInfos: readonly NodeData[];
    readonly geometry: NodeGeometry;
}

/** @internal */
export interface ReadyMessage extends NodePayload {
    readonly kind: "ready";
    readonly id: string;
}

/** @internal */
export interface AbortedMessage {
    readonly kind: "aborted";
    readonly id: string;
}

/** @internal */
export interface ErrorMessage {
    readonly kind: "error";
    readonly id: string;
    readonly error: any;
}

/** @internal */
export type MessageRequest = InitMessage | ParseMessage | LoadMessage | AbortMessage | AbortAllMessage | CloseMessage;
/** @internal */
export type MessageResponse = ReadyMessage | AbortedMessage | AbortedAllMessage | ErrorMessage | BufferSet;
