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

export class Downloader {
    activeDownloads = 0;
    completeResolve: (() => void) | undefined;
    public static createImageData?: (blob: Blob) => Promise<ImageData>;

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

    private async request(filename: string) {
        const url = new URL(filename, this.baseUrl);
        if (!url.search)
            url.search = this.baseUrl?.search ?? "";
        const response = await fetch(url.toString(), { mode: "cors" });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}: ${response.statusText} (${url})`);
        }
        return response;
    }

    downloadArrayBufferAbortable(filename: string, buffer?: ArrayBuffer): AbortableDownload {
        const self = this;
        const download = new AbortableDownload(buffer != undefined ? downloadAsyncSize : downloadAsync);
        download.start();
        return download;

        async function downloadAsyncSize() {
            try {
                self.activeDownloads++;
                const response = await self.request(filename);
                if (!response.ok)
                    throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
                const reader = response.body!.getReader(); // waiting for safari and typescript to include the byob mode here.
                const content = new Uint8Array(buffer!);
                let offset = 0;
                while (!download.aborted) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    content.set(value, offset);
                    offset += value.length;
                }
                if (!download.aborted) {
                    console.assert(offset == content.length);
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
