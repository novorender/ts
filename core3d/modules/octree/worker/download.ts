import { removeOfflineFile, requestOfflineFile } from "offline/file";

/** @internal */
export class AbortableDownload {
    result: Promise<ArrayBuffer | undefined> = Promise.resolve(undefined);
    aborted = false;

    constructor(private readonly download: () => Promise<ArrayBuffer | undefined>) {
    }

    start() {
        this.result = this.download();
    }

    abort() {
        this.aborted = true;
    }
}

/** @internal */
export class Downloader {
    activeDownloads = 0;
    completeResolve: (() => void) | undefined;

    constructor(public baseUrl?: URL) {
    }

    async complete() {
        if (this.activeDownloads > 0) {
            const completePromise = new Promise<void>((resolve, reject) => {
                this.completeResolve = resolve;
            });
            await completePromise;
            this.completeResolve = undefined;
        }
    }

    private getUrl(filename: string) {
        const url = new URL(filename, this.baseUrl);
        if (!url.search)
            url.search = this.baseUrl?.search ?? "";
        return url;
    }

    private async request(filename: string) {
        const url = this.getUrl(filename);
        const request = new Request(url, { mode: "cors" });
        const response = await requestOfflineFile(request) ?? await fetch(request);
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}: ${response.statusText} (${url})`);
        }
        return response;
    }

    private async removeFile(filename: string): Promise<boolean> {
        const url = this.getUrl(filename);
        const request = new Request(url, { mode: "cors" });
        return removeOfflineFile(request);
    }

    downloadArrayBufferAbortable(filename: string, buffer?: ArrayBuffer): AbortableDownload {
        const self = this;
        const download = new AbortableDownload(buffer != undefined ? downloadAsyncSize : downloadAsync);
        download.start();
        return download;

        async function downloadAsyncSize() {
            try {
                self.activeDownloads++;
                let offset = 0;
                let reader: ReadableStreamDefaultReader<Uint8Array>;
                const fetchFile = async () => {
                    const response = await self.request(filename);
                    if (!response.ok)
                        throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
                    reader = response.body!.getReader(); // waiting for safari and typescript to include the byob mode here.
                    const content = new Uint8Array(buffer!);

                    while (!download.aborted) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        content.set(value, offset);
                        offset += value.length;
                    }
                    return content;
                }
                let content = await fetchFile();

                if (!download.aborted) {
                    if (offset != content.length) {
                        console.error(`Corrupt file ${filename}, will try to redownload`);
                        if (await self.removeFile(filename)) {
                            offset = 0;
                            content = await fetchFile();
                        }
                    }
                    if (!download.aborted) {
                        console.assert(offset == content.length);
                        return content.buffer;
                    }
                    reader!.cancel();
                } else {
                    reader!.cancel();
                }
            } finally {
                self.activeDownloads--;
                if (self.activeDownloads == 0 && self.completeResolve) {
                    self.completeResolve();
                }
            }
        }

        async function downloadAsync() {
            try {
                self.activeDownloads++;
                const response = await self.request(filename);
                if (!response.ok)
                    throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
                // return await response.arrayBuffer(); // sometimes skips/gives up on downloads when previously cancelled, so we use streaming instead.
                const reader = response.body!.getReader();
                const chunks: Uint8Array[] = [];
                let size = 0; // If compressed, we can't use content-length to determine uncompressed length up front, so we must store chunks and then assemble into final buffer.
                while (!download.aborted) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    chunks.push(value);
                    size += value.length;
                }
                if (!download.aborted) {
                    const content = new Uint8Array(size);
                    let offset = 0;
                    for (const chunk of chunks) {
                        content.set(chunk, offset);
                        offset += chunk.length;
                    }
                    return content.buffer;
                } else {
                    reader.cancel();
                }
            } finally {
                self.activeDownloads--;
                if (self.activeDownloads == 0 && self.completeResolve) {
                    self.completeResolve();
                }
            }
        }
    }
}
