export class AbortableDownload {
    abortController: AbortController | undefined; // = new AbortController();
    result: Promise<ArrayBuffer | undefined> = Promise.resolve(undefined);
    aborted = false;

    constructor(private readonly download: () => Promise<ArrayBuffer | undefined>) {
    }

    start() {
        this.result = this.download();
    }

    abort() {
        if (!this.aborted) {
            this.aborted = true;
            this.abortController?.abort();
        }
    }
}

export class Downloader {
    activeDownloads = 0;
    private abortController = new AbortController();
    public static createImageData?: (blob: Blob) => Promise<ImageData>;

    constructor(public baseUrl?: URL) {
    }

    abort() {
        this.abortController.abort();
        this.abortController = new AbortController(); // we probably want to reuse this object, so create another abort controller.
    }

    async request(filename: string, abortController: AbortController | undefined) {
        const url = new URL(filename, this.baseUrl);
        if (!url.search)
            url.search = this.baseUrl?.search ?? "";
        const signal = (abortController ?? this.abortController).signal;
        const response = await fetch(url.toString(), { mode: "cors", signal });
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}: ${response.statusText} (${url})`);
        }
        return response;
    }

    async downloadJson(filename: string, abortController?: AbortController): Promise<any> {
        try {
            this.activeDownloads++;
            const response = await this.request(filename, abortController);
            return await response.json();
        } finally {
            this.activeDownloads--;
        }
    }

    async downloadArrayBuffer(filename: string, abortController?: AbortController): Promise<ArrayBuffer> {
        try {
            this.activeDownloads++;
            const response = await this.request(filename, abortController);
            if (!response.ok)
                throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
            return await response.arrayBuffer();
        } finally {
            this.activeDownloads--;
        }
    }

    downloadArrayBufferAbortable(filename: string, buffer?: ArrayBuffer): AbortableDownload {
        const self = this;
        const download = new AbortableDownload(buffer != undefined ? downloadAsyncSize : downloadAsync);
        download.start();
        return download;

        async function downloadAsyncSize() {
            try {
                self.activeDownloads++;
                const response = await self.request(filename, download.abortController);
                if (!response.ok)
                    throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
                download.abortController = undefined;
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
            }
        }

        async function downloadAsync() {
            try {
                self.activeDownloads++;
                const response = await self.request(filename, download.abortController);
                if (!response.ok)
                    throw new Error(`HTTP error: ${response.status} ${response.statusText}!`);
                download.abortController = undefined;
                // return await response.arrayBuffer(); // sometimes skips/gives up on downloads when previously cancelled, so we use streaming instead.
                const reader = response.body!.getReader();
                const chunks: Uint8Array[] = [];
                let size = 0; // If compressed, we can't use content-length to determined uncompressed length up front, so we must store chunks and then assemble into final buffer.
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
            }
        }
    }

    async downloadBlob(filename: string, abortController?: AbortController): Promise<Blob> {
        try {
            this.activeDownloads++;
            const response = await this.request(filename, abortController);
            return await response.blob();
        } finally {
            this.activeDownloads--;
        }
    }

    async downloadImage(filename: string, abortController?: AbortController): Promise<ImageBitmap | ImageData> {
        try {
            this.activeDownloads++;
            const blob = await this.downloadBlob(filename, abortController);
            const image = this.createImageFromBlob(blob);
            return image;
        } finally {
            this.activeDownloads--;
        }
    }

    async createImageFromBlob(blob: Blob): Promise<ImageBitmap | ImageData> {
        const image = await ("OffscreenCanvas" in self ?
            createImageBitmap(blob) :
            Downloader.createImageData!(blob));
        return image;
    }
}
