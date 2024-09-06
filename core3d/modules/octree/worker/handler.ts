import { AbortableDownload, Downloader } from "./download";
import { Mutex } from "../mutex";
import { parseNode } from "./parser";
import type { AbortAllMessage, AbortMessage, AbortedAllMessage, AbortedMessage, ParseMessage, ErrorMessage, LoadMessage, ReadyMessage, MessageRequest, MessageResponse, ParseParams, BufferSet, InitMessage } from "./messages";
import { esbuildWasmInstance, type WasmInstance } from "./wasm_loader";

export interface HighlightsBuffer {
    readonly buffer: SharedArrayBuffer;
    readonly indices: Uint8Array;
    readonly mutex: Mutex;
}
/** @internal */
export class LoaderHandler {
    readonly downloader = new Downloader();
    readonly downloads = new Map<string, AbortableDownload>();
    highlights: HighlightsBuffer = undefined!; // will be set right after construction by "buffer" message
    wasm: WasmInstance | undefined;

    constructor(readonly send: (msg: MessageResponse, transfer?: Transferable[]) => void) {
    }

    receive(msg: MessageRequest) {
        switch (msg.kind) {
            case "init":
                this.init(msg);
                break;
            case "parse":
                this.parse(msg);
                break;
            case "load":
                this.load(msg);
                break;
            case "abort":
                this.abort(msg);
                break;
            case "abort_all":
                this.abortAll(msg);
                break;
            // default:
            //     console.warn(`Unknown load message: ${msg}!`);
            //     break;
        }
    }

    private async init(msg: InitMessage) {
        const { wasmData, buffer } = msg;

        this.wasm = await esbuildWasmInstance(wasmData);

        const indices = new Uint8Array(buffer, 4);
        const mutex = new Mutex(buffer);
        this.highlights = { buffer, indices, mutex };
        const setBufferMsg = { kind: "buffer" } as BufferSet;
        this.send(setBufferMsg);
    }

    private parseBuffer(buffer: ArrayBuffer, params: ParseParams) {
        if (this.wasm) {
            const { highlights } = this;
            const { enableOutlines, applyFilter, config, id } = params;
            const { childInfos, geometry } = parseNode(this.wasm, config, enableOutlines, buffer, highlights, applyFilter);
            const readyMsg: ReadyMessage = { kind: "ready", id, childInfos, geometry };
            const transfer: Transferable[] = [];
            for (const { vertexBuffers, indices } of geometry.subMeshes) {
                transfer.push(...vertexBuffers);
                if (typeof indices != "number") {
                    transfer.push(indices.buffer);
                }
            }
            this.send(readyMsg, transfer);
        } else {
            console.error("Wasm is not initialized yet");
        }
    }

    private async parse(params: ParseMessage) {
        const { id, buffer } = params;
        try {
            this.parseBuffer(buffer, params);
        } catch (error) {
            this.error(id, error);
        }
    }

    private async load(params: LoadMessage) {
        const { downloader, downloads } = this;
        const { url, id, byteSize } = params;
        try {
            const download = downloader.downloadArrayBufferAbortable(url, new ArrayBuffer(byteSize));
            downloads.set(id, download);
            const buffer = await download.result;
            downloads.delete(id);
            if (buffer) {
                this.parseBuffer(buffer, params);
            } else {
                const abortedMsg: AbortedMessage = { kind: "aborted", id };
                this.send(abortedMsg);
            }
        } catch (error) {
            this.error(id, error);
        }
    }

    private removeNode(id: string) {
        const { downloads } = this;
        const download = downloads.get(id);
        downloads.delete(id);
        return { download };
    }

    private error(id: string, error: any) {
        const { download } = this.removeNode(id);
        const errorMsg = { kind: "error", id, error } as ErrorMessage;
        this.send(errorMsg);
    }

    private abort(params: AbortMessage) {
        const { id } = params;
        const { download } = this.removeNode(id);
        download?.abort();
    }

    private async abortAll(params: AbortAllMessage) {
        const { downloads, downloader } = this;
        for (const download of downloads.values()) {
            download.abort();
        }
        await downloader.complete();
        console.assert(downloads.size == 0);
        const abortedAllMsg = { kind: "aborted_all" } as AbortedAllMessage;
        this.send(abortedAllMsg);
    }
}