import { type OfflineStorage, type OfflineDirectory, RequestFormatter } from "../storage";
import { PromiseBag } from "./promiseBag";
import type { CreateDirResponse, CreateDirRequest, DeleteAllRequest, DirsRequest, DirsResponse, FilesRequest, IOResponse, ReadRequest, ReadResponse, DeleteAllResponse, FilesResponse, WriteRequest, WriteResponse, DeleteFilesRequest, DeleteFilesResponse, DeleteDirRequest, DeleteDirResponse } from "./messages";
import type { defaultRequestFormatter } from "../";

/**
 * Create an OPFS based offline storage.
 * @param version Version string for offline storage schema
 * @param requestFormatter The formatter for converting directory and file names into fetch() requests and vice versa.
 * @param worker The IO worker, either directly from main thread, or indirectly from service worker. (Safari doesn't support OPFS directly from service worker).
 * @remarks
 * If you use the standard novorender cloud storage, you may use the {@link defaultRequestFormatter} to create the the requestFormatter.
 */
export async function createOPFSStorage(version: string, requestFormatter: RequestFormatter, worker: Worker | MessagePort): Promise<OfflineStorage> {
    const storage = new OfflineStorageOPFS(version, requestFormatter, worker);
    await storage.init();
    return storage;
}

class OfflineStorageOPFS implements OfflineStorage {
    readonly promises = new PromiseBag();
    readonly dirs = new Map<string, OfflineDirectoryOPFS>();

    constructor(readonly version: string, readonly requestFormatter: RequestFormatter, readonly worker: Worker | MessagePort) {
        worker.onmessage = (message: MessageEvent<IOResponse>) => {
            const { data } = message;
            this.promises.resolve(data.id, data);
        };
    }

    // initialize existing directories from storage
    async init(): Promise<void> {
        const { worker, promises, dirs } = this;
        const id = promises.newId();
        const msg: DirsRequest = { kind: "dirs", id };
        worker.postMessage(msg);
        const response = await promises.create<DirsResponse>(id);
        if (response.error) {
            throw new Error(response.error);
        }
        for (const name of response.dirs) {
            const dir = new OfflineDirectoryOPFS(this, name);
            dirs.set(name, dir);
        }
    }

    isAsset(request: Request): boolean {
        return this.requestFormatter.tryDecode(request) != undefined;
    }

    async fetch(request: Request): Promise<Response | undefined> {
        const { worker, requestFormatter, promises } = this;
        const { dir, file } = requestFormatter.decode(request);
        const id = promises.newId();
        const msg: ReadRequest = { kind: "read", id, dir, file };
        worker.postMessage(msg);
        const response = await promises.create<ReadResponse>(id);
        if (!response.error && response.buffer) {
            return new Response(response.buffer, { status: 200, headers: { "Content-Type": "application/octet-stream", "Content-Length": `${response.buffer!.byteLength}` } });
        }
    }

    get existingDirectories() {
        return this.dirs.values();
    }

    hasDirectory(name: string): boolean {
        return this.dirs.has(name);
    }

    async directory(name: string): Promise<OfflineDirectory> {
        const { dirs } = this;
        let dir = dirs.get(name);
        if (!dir) {
            dir = await this.addDirectory(name);
            dirs.set(name, dir);
        }
        return dir;
    }

    async addDirectory(name: string) {
        const { worker, promises } = this;
        const id = promises.newId();
        const msg: CreateDirRequest = { kind: "create_dir", id, dir: name };
        worker.postMessage(msg);
        const response = await promises.create<CreateDirResponse>(id);
        if (response.error) {
            throw new Error(response.error); // existing directory won't return error.
        }
        return new OfflineDirectoryOPFS(this, name);
    }

    async deleteAll() {
        const { worker, promises } = this;
        const id = promises.newId();
        const msg: DeleteAllRequest = { kind: "delete_all", id };
        worker.postMessage(msg);
        const response = await promises.create<DeleteAllResponse>(id);
        if (response.error) {
            throw new Error(response.error);
        }
        this.dirs.clear();
    }
}

class OfflineDirectoryOPFS implements OfflineDirectory {
    constructor(readonly context: OfflineStorageOPFS, readonly name: string) { }

    request(name: string): Request {
        const { context } = this;
        const { requestFormatter } = context;
        return requestFormatter.request(this.name, name);
    }

    async* files(): AsyncIterableIterator<string> {
        const { context, name } = this;
        const { worker, promises } = context;
        const id = promises.newId();
        const msg: FilesRequest = { kind: "files", id, dir: name };
        worker.postMessage(msg);
        const response = await promises.create<FilesResponse>(id);
        if (response.error) {
            throw new Error(response.error);
        }
        for (const file of response.files) {
            yield file;
        }
    }

    async read(name: string): Promise<ArrayBuffer | undefined> {
        const { context } = this;
        const { worker, promises } = context;
        const id = promises.newId();
        const msg: ReadRequest = { kind: "read", id, dir: this.name, file: name };
        worker.postMessage(msg);
        const response = await promises.create<ReadResponse>(id);
        if (response.error) {
            console.warn(response.error);
        }
        return response.buffer;
    }

    async write(name: string, buffer: ArrayBuffer): Promise<void> {
        const { context } = this;
        const { worker, promises } = context;
        const id = promises.newId();
        const msg: WriteRequest = { kind: "write", id, dir: this.name, file: name, buffer };
        worker.postMessage(msg, [buffer]);
        const response = await promises.create<WriteResponse>(id);
        if (response.error) {
            throw new Error(response.error);
        }
    }

    async deleteFiles(names: Iterable<string>): Promise<void> {
        const { context } = this;
        const { worker, promises } = context;
        const id = promises.newId();
        const msg: DeleteFilesRequest = { kind: "delete_files", id, dir: this.name, files: [...names] };
        worker.postMessage(msg);
        const response = await promises.create<DeleteFilesResponse>(id);
        if (response.error) {
            throw new Error(response.error);
        }
    }

    async delete(): Promise<void> {
        const { context } = this;
        const { worker, promises } = context;
        const id = promises.newId();
        const msg: DeleteDirRequest = { kind: "delete_dir", id, dir: this.name };
        worker.postMessage(msg);
        context.dirs.delete(this.name);
        const response = await promises.create<DeleteDirResponse>(id);
        if (response.error) {
            throw new Error(response.error);
        }
    }
}