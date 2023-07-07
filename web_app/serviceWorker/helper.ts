import { PromiseBag, type ConnectRequest, type ReadRequest, type ReadResponse } from ".";

// this class helps handle the service worker tasks for offline caching and loading of a scene
export class ServiceWorkerHelper {
    private _port: MessagePort | undefined;
    private _reads = new PromiseBag<ArrayBuffer>();

    constructor(readonly binaryAssetRegex: RegExp, readonly cache: Cache, readonly root?: FileSystemDirectoryHandle) {
    }

    handleConnectMessage(message: MessageEvent<ConnectRequest>) {
        const { data } = message;
        switch (data.kind) {
            case "connect": {
                const { port } = data;
                this._port = port;
                port.onmessage = this.handleIOMessage.bind(this);
                console.log("sw connected!");
                break;
            }
        }
    }

    private handleIOMessage(message: MessageEvent<ReadResponse>) {
        const { data } = message;
        switch (data.kind) {
            case "read": {
                const { id, buffer, error } = data;
                this._reads.resolve(id, buffer ?? new Error(error));
                break;
            }
        }
    }

    isAsset(url: string) {
        return this.binaryAssetRegex.test(new URL(url).pathname);
    }

    private getDirAndFile(url: URL) {
        const m = this.binaryAssetRegex.exec(url.pathname);
        if (!m)
            throw new Error(`Invalid URL pathname: ${url.pathname}`);
        const [_, dir, file] = m;
        return { dir, file } as const;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const { dir, file } = this.getDirAndFile(url);
        const body = await this.readFile(dir, file);
        if (body) {
            return new Response(body, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }); // TODO: Add info from request, e.g. url
        } else {
            // const response = await this.cache.match(request);
            // if (response) {
            //     return response;
            // }
        }
        // await this.cache.add(request);
        console.log(`fetch ${url}`);
        return await fetch(request);
    }

    async readFile(dir: string, filename: string) {
        try {
            if (this.root) {
                // const root = await navigator.storage.getDirectory();
                const folder = await this.root.getDirectoryHandle(dir, { create: false });
                const fileHandle = await folder.getFileHandle(filename, { create: false });
                const file = await fileHandle.getFile();
                return file.stream();
            } else {
                const { _port, _reads } = this;
                if (_port) {
                    const id = _reads.newId();
                    const msg: ReadRequest = { kind: "read", id, dir, file: filename };
                    _port?.postMessage(msg);
                    return await _reads.create(id);
                }
            }
        } catch (ex: any) {
            // console.error(ex.message);
        }
    }
}


