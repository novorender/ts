export * from "./helper";
export * from "./promiseBag";

export interface ConnectRequest {
    readonly kind: "connect";
    readonly port: MessagePort;
}

export interface ReadRequest {
    readonly kind: "read";
    readonly id: number;
    readonly dir: string;
    readonly file: string;
}

export interface WriteRequest {
    readonly kind: "write";
    readonly id: number;
    readonly dir: string;
    readonly file: string;
    readonly buffer: ArrayBuffer;
}

export type IORequest = ReadRequest | WriteRequest;

export interface ReadResponse {
    readonly kind: "read";
    readonly id: number;
    readonly buffer: ArrayBuffer | undefined;
    readonly error?: string;
}

export interface WriteResponse {
    readonly kind: "write";
    readonly id: number;
    readonly error?: string;
}

export type IOResponse = ReadResponse | WriteResponse;
