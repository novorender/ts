export * from "./helper";
export * from "./promiseBag";

/** @internal */
export interface ConnectRequest {
    readonly kind: "connect";
    readonly port: MessagePort;
}

/** @internal */
export interface ReadRequest {
    readonly kind: "read";
    readonly id: number;
    readonly dir: string;
    readonly file: string;
}

/** @internal */
export interface WriteRequest {
    readonly kind: "write";
    readonly id: number;
    readonly dir: string;
    readonly file: string;
    readonly buffer: ArrayBuffer;
}

/** @internal */
export type IORequest = ReadRequest | WriteRequest;

/** @internal */
export interface ReadResponse {
    readonly kind: "read";
    readonly id: number;
    readonly buffer: ArrayBuffer | undefined;
    readonly error?: string;
}

/** @internal */
export interface WriteResponse {
    readonly kind: "write";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export type IOResponse = ReadResponse | WriteResponse;
