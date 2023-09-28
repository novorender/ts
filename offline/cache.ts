import { type OfflineStorage, type OfflineDirectory, RequestFormatter } from "./storage";

/**
 * Create a cached based offline storage.
 * @param version Version string for offline storage schema
 * @param requestFormatter The formatter for converting directory and file names into fetch() requests and vice versa.
 * @remarks
 * If you use the standard novorender cloud storage, you may use the {@link defaultRequestFormatter} to create the the requestFormatter.
 */
export async function createCacheStorage(version: string, requestFormatter: RequestFormatter): Promise<OfflineStorage> {
    const storage = new OfflineStorageCache(version, requestFormatter);
    await storage.init();
    return storage;
}

const cacheQueryOptions: CacheQueryOptions = {
    ignoreSearch: true, // SAS key will change over time, so ignore
}


class OfflineStorageCache implements OfflineStorage {
    readonly dirs = new Map<string, OfflineDirectoryCache>();

    constructor(readonly version: string, readonly requestFormatter: RequestFormatter) {
    }

    private get prefix() {
        return `${this.version}_`;
    }

    private cacheName(dirName: string) {
        return `${this.prefix}${dirName}`;
    }

    // initialize existing directories from storage
    async init(): Promise<void> {
        const { prefix, dirs } = this;
        var keys = await caches.keys();
        for (const key of keys) {
            if (key.startsWith(prefix)) {
                const name = key.slice(prefix.length);
                const cache = await caches.open(key);
                const dir = new OfflineDirectoryCache(this, cache, name);
                dirs.set(name, dir);
            }
        }
    }

    isAsset(request: Request): boolean {
        return this.requestFormatter.tryDecode(request) != undefined;
    }

    async fetch(request: Request): Promise<Response | undefined> {
        return await caches.match(request, cacheQueryOptions);
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
        const cacheName = this.cacheName(name)
        const cache = await caches.open(cacheName);
        const dir = new OfflineDirectoryCache(this, cache, name);
        return dir;
    }

    async deleteAll() {
        for (const key of await caches.keys()) {
            await caches.delete(key);
        }
        this.dirs.clear();
    }
}

class OfflineDirectoryCache implements OfflineDirectory {
    constructor(readonly context: OfflineStorageCache, readonly cache: Cache, readonly name: string) { }

    request(name: string): Request {
        const { context } = this;
        const { requestFormatter } = context;
        return requestFormatter.request(this.name, name);
    }

    async* files(): AsyncIterableIterator<string> {
        const { context, cache } = this;
        const { requestFormatter } = context;
        const requests = await cache.keys(undefined, cacheQueryOptions);
        for await (const request of requests) {
            const { file } = requestFormatter.decode(request);
            yield file;
        }
    }

    // async size(name: string) {
    //     const { cache } = this;
    //     const request = this.request(name);
    //     const response = await cache.match(request, cacheQueryOptions);
    //     if (response?.ok) {
    //         const contentLength = response.headers.get("Content-Length");
    //         if (contentLength != undefined) {
    //             const size = Number.parseInt(contentLength);
    //             if (!Number.isNaN(size)) {
    //                 return size;
    //             }
    //         }
    //     }
    //     throw new Error(`No valid cache entry found for "${name}"!`);
    // }

    private async get(name: string): Promise<Response | undefined> {
        const { cache } = this;
        const request = this.request(name);
        const response = await cache.match(request, cacheQueryOptions);
        if (response?.ok) {
            return response;
        }
    }

    // async open(name: string): Promise<ReadableStream | undefined> {
    //     const response = await this.get(name);
    //     return response?.body!;
    // }

    async read(name: string): Promise<ArrayBuffer | undefined> {
        const response = await this.get(name);
        return response?.arrayBuffer();
    }

    async write(name: string, buffer: ArrayBuffer): Promise<void> {
        const { cache } = this;
        const request = this.request(name);
        const init: ResponseInit = {
            status: 200,
            headers: {
                "Content-Length": buffer.byteLength.toString(),
            },
        };
        const response = new Response(buffer, init);
        await cache.put(request, response);
    }

    async deleteFiles(names: Iterable<string>): Promise<void> {
        const { cache } = this;
        for (const name of names) {
            const request = this.request(name);
            const success = await cache.delete(request, cacheQueryOptions);
            if (!success) {
                console.warn(`Failed to delete ${name} from cache!`);
            }
        }
    }

    async delete(): Promise<void> {
        const { context, name } = this;
        const { version } = context;
        const key = `${name}_${version}`;
        const result = await caches.delete(key);
        console.assert(result);
    }
}