/** @internal */
export interface ConnectRequest {
    readonly kind: "connect";
    readonly clientId: string;
}

export interface ConnectResponse {
    readonly kind: "connect";
    readonly port: MessagePort;
}

export interface ConnectAcknowledge {
    readonly kind: "connected";
}


/** @internal */
export interface CreateDirRequest {
    readonly kind: "create_dir";
    readonly id: number;
    readonly dir: string;
}

/** @internal */
export interface DirsRequest {
    readonly kind: "dirs";
    readonly id: number;
}

/** @internal */
export interface FilesRequest {
    readonly kind: "files";
    readonly id: number;
    readonly dir: string;
}

/** @internal */
export interface FileSizesRequest {
    readonly kind: "file_sizes";
    readonly id: number;
    readonly dir: string;
    readonly files?: readonly string[];
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
export interface OpenStreamRequest {
    readonly kind: "open_write_stream";
    readonly id: number;
    readonly size: number;
    readonly dir: string;
    readonly file: string;
}

/** @internal */
export interface AppendStreamRequest {
    readonly kind: "append_stream";
    readonly id: number;
    readonly dir: string;
    readonly file: string;
    readonly buffer: ArrayBuffer;
}

/** @internal */
export interface CloseStreamRequest {
    readonly kind: "close_write_stream";
    readonly id: number;
    readonly dir: string;
    readonly file: string;
}

/** @internal */
export interface DeleteFilesRequest {
    readonly kind: "delete_files";
    readonly id: number;
    readonly dir: string;
    readonly files: readonly string[];
}

/** @internal */
export interface DeleteDirRequest {
    readonly kind: "delete_dir";
    readonly id: number;
    readonly dir: string;
}

/** @internal */
export interface DeleteAllRequest {
    readonly kind: "delete_all";
    readonly id: number;
}

/** @internal */
export type IORequest = CreateDirRequest | DirsRequest | FilesRequest | FileSizesRequest | ReadRequest | WriteRequest | OpenStreamRequest | AppendStreamRequest | CloseStreamRequest | DeleteFilesRequest | DeleteDirRequest | DeleteAllRequest;


/** @internal */
export interface CreateDirResponse {
    readonly kind: "create_dir";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export interface DirsResponse {
    readonly kind: "dirs";
    readonly id: number;
    readonly dirs: readonly string[];
    readonly error?: string;
}

/** @internal */
export interface FilesResponse {
    readonly kind: "files";
    readonly id: number;
    readonly files: readonly string[];
    readonly error?: string;
}

/** @internal */
export interface FileSizesResponse {
    readonly kind: "file_sizes";
    readonly id: number;
    readonly sizes: readonly (number | undefined)[];
    readonly error?: string;
}

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
export interface OpenStreamResponse {
    readonly kind: "open_write_stream";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export interface AppendStreamResponse {
    readonly kind: "append_stream";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export interface CloseStreamResponse {
    readonly kind: "close_write_stream";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export interface DeleteFilesResponse {
    readonly kind: "delete_files";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export interface DeleteDirResponse {
    readonly kind: "delete_dir";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export interface DeleteAllResponse {
    readonly kind: "delete_all";
    readonly id: number;
    readonly error?: string;
}

/** @internal */
export type IOResponse = CreateDirResponse | DirsResponse | FilesResponse | FileSizesResponse | ReadResponse | WriteResponse | OpenStreamResponse | AppendStreamResponse | CloseStreamResponse | DeleteFilesResponse | DeleteDirResponse | DeleteAllResponse;
