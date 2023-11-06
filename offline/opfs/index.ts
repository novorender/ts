import { type ResourceType, type PathNameParser } from "../storage";
import { PromiseBag } from "./promiseBag";
import type { CreateDirResponse, CreateDirRequest, DeleteAllRequest, DirsRequest, DirsResponse, FilesRequest, IOResponse, ReadRequest, ReadResponse, DeleteAllResponse, FilesResponse, WriteRequest, WriteResponse, DeleteFilesRequest, DeleteFilesResponse, DeleteDirRequest, DeleteDirResponse, FileSizesRequest, FileSizesResponse } from "./messages";

/**
 * Create an OPFS based offline storage.
 * @param version Version string for offline storage schema
 * @param requestFormatter The formatter for converting directory and file names into fetch() requests and vice versa.
 * @param worker The IO worker, either directly from main thread, or indirectly from service worker. (Safari doesn't support OPFS directly from service worker).
 * @remarks
 * If you use the standard novorender cloud storage, you may use the {@link defaultRequestFormatter} to create the the requestFormatter.
 */
export async function createOPFSStorage(version: string, worker: Worker | MessagePort): Promise<OfflineStorageOPFS> {
    const storage = new OfflineStorageOPFS(version, worker);
    await storage.init();
    return storage;
}

class OfflineStorageOPFS {
    readonly promises = new PromiseBag();
    readonly dirs = new Map<string, OfflineDirectoryOPFS>();
    readonly baseUrl = new URL("https://blobs.novorender.com/");
    readonly mode = "cors";

    constructor(readonly version: string, readonly worker: Worker | MessagePort) {
        worker.onmessage = (message: MessageEvent<IOResponse>) => {
            const { data } = message;
            this.promises.resolve(data.id, data);
        };
    }

    parse(str: string) {
        const re = new RegExp(`^\/(?<dir>[0-9a-f]{32})\/(?<file>.+)$`);
        return str.match(re)?.groups as ReturnType<PathNameParser>;
    }

    format(dir: string, file: string, type: ResourceType) {
        return `/${dir}${type ? `/${type}` : ""}/${file}`;
    }

    /**
     * @internal initialize existing directories from storage
     */
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

    /**
    * Decode request into directory and file name.
    * @param request A request generated from the {@link request} function.
    * @returns Request directory and file name, if url matches asset pattern, undefined otherwise.
    */
    tryDecode(request: Request) {
        const { pathname } = new URL(request.url);
        return this.parse(pathname);
    }

    /**
     * Decode request into directory and file name.
     * @param request A request generated from the {@link request} function.
     * @returns Request directory and file name.
     */
    decode(request: Request) {
        const result = this.tryDecode(request);
        if (!result)
            throw new Error("Request does not match valid pattern!");
        return result;
    }



    /**
     * Create a resource request.
     * @param dir The storage directory name.
     * @param file The storage file name.
     * @param signal A signal for aborting the request.
     * @param applyQuery Whether or not to apply query string to request url.
     * @returns A Request to feed to fetch() API and/or to match against cache entries.
     */
    request(dir: string, file: string, type: ResourceType, query?: string, signal?: AbortSignal): Request {
        const { baseUrl, mode } = this;
        const url = new URL(this.format(dir, file, type), baseUrl);
        if (query)
            url.search = query;
        return new Request(url, { mode, signal });
    }

    /**
     * Determine if request is a potential offline asset or not.
     * @param request The resource request
     * @returns True, if request url matches that of a potential offline asset, False, if not.
     * @remarks
     * This function only check if the URL matches the pattern of potential offline assets,
     * not if it's actually available offline or not.
     * It's only meant as an early screening to not intercept purely online content.
     */
    isAsset(request: Request): boolean {
        return this.tryDecode(request) != undefined;
    }

    /**
     * Fetch resource from offline storage, if available.
     * @param request The resource request
     * @returns A response or undefined if no match was found.
     */
    async fetch(request: Request): Promise<Response | undefined> {
        const { worker, promises } = this;
        const { dir, file } = this.decode(request);
        const id = promises.newId();
        const msg: ReadRequest = { kind: "read", id, dir, file };
        worker.postMessage(msg);
        const response = await promises.create<ReadResponse>(id);
        if (!response.error && response.buffer) {
            return new Response(response.buffer, { status: 200, headers: { "Content-Type": "application/octet-stream", "Content-Length": `${response.buffer!.byteLength}` } });
        }
    }

    /** Existing directory names in this storage. */
    get existingDirectories() {
        return this.dirs.values();
    }

    /** Check if directory already exists. */
    hasDirectory(name: string): boolean {
        return this.dirs.has(name);
    }

    /**
     * Get or create a directory by name.
     * @param name The directory name.
     * @returns The directory storage.
     */
    async directory(name: string): Promise<OfflineDirectoryOPFS> {
        const { dirs } = this;
        let dir = dirs.get(name);
        if (!dir) {
            dir = await this.addDirectory(name);
            dirs.set(name, dir);
        }
        return dir;
    }

    private async addDirectory(name: string) {
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

    /**
     * Delete everything in this storage, including folders using a different/older schema.
     */
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


/**
 * Offline directory interface.
 * @remarks
 * This objects offers a basic file folder-like abstraction for offline storage.
 */
class OfflineDirectoryOPFS {

    constructor(
        readonly context: OfflineStorageOPFS,
        /** The name of this folder. */
        readonly name: string) { }

    /**
     * Retrive the file names of this directory.
     * @remarks
     * Potentially slow?
     */
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

    /**
     * Retrive the name and size of files downloaded to this directory.
     * @remarks
     * Will be cleared uplon fully downloading a scene as manifest can be used instead.
     */
    async getJournalEntries(): Promise<IterableIterator<{ name: string, size: number }>> {
        const journal = await this.read("journal");
        function* iterate() {
            if (journal) {
                const buffer = new Uint8Array(journal);
                const decoder = new TextDecoder();
                let prevIndex = 0;
                while (prevIndex < buffer.length) {
                    let index = buffer.indexOf(10, prevIndex);
                    const line = buffer.subarray(prevIndex, index);
                    const text = decoder.decode(line, { stream: true });
                    const [name, sizeStr] = text.split(",");
                    const size = Number.parseInt(sizeStr);
                    prevIndex = index + 1;
                    yield { name, size };
                }
            }
        }
        return iterate();
    }


    /**
     * Retrive the file sizes.
     * @param fileNames Optional list of files, or all files in dir if undefined.
     * @returns List of files sizes or undefined for files not found.
     */
    async* filesSizes(fileNames?: readonly string[]): AsyncIterableIterator<number | undefined> {
        if (fileNames) {
            const { context, name } = this;
            const { worker, promises } = context;
            const id = promises.newId();
            const msg: FileSizesRequest = { kind: "file_sizes", id, dir: name, files: fileNames };
            worker.postMessage(msg);
            const response = await promises.create<FileSizesResponse>(id);
            if (response.error) {
                throw new Error(response.error);
            }
            for (const size of response.sizes) {
                yield size;
            }
        } else {
            const entries = await this.getJournalEntries();
            for (const { size } of entries) {
                yield size
            }
        }
    }

    /**
     * Read the specified file as an ArrayBuffer.
     * @param name The file name to read.
     * @returns The file content, or undefined if file does not exist.
     */
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

    /**
     * Write the content of a file.
     * @param name: The file name to write.
     * @param buffer: The new content of this file.
     * @remarks
     * The input buffer may be transferred to an underlying worker and become inaccessible from the calling thread.
     * Thus, you should pass a copy if you need to retain the original.
     */
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

    /**
     * Delete the specified file.
     * @param names The file names to delete.
     */
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

    /**
     * Delete folder and everything inside it.
     */
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

export type { OfflineStorageOPFS, OfflineDirectoryOPFS };