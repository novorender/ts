import { createCacheOfflineStorage, createOPFSOfflineStorage } from "../";
import type { ConnectAcknowledge, ConnectRequest, ConnectResponse } from "../opfs/messages";
import { type OfflineStorage } from "../storage";

/**
 * Handle service worker messages.
 * @param event The service worker message to handle.
 * @remarks
 * You must call this function from your service worker {@link https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/message_event | ServiceWorkerGlobalScope: message} event to support offline storage.
 */
export async function serviceWorkerHandleMessage(event: MessageEvent<ConnectResponse>) {
    const { source, data } = event;
    switch (data.kind) {
        case "connect": {
            const { port, sasKey } = data;
            const storage = port ? await createOPFSOfflineStorage(port, sasKey) : await createCacheOfflineStorage(sasKey);
            if (source && source instanceof Client) {
                console.log(`Client ${source.id} connected to service worker!`);
                const clientId = source.id;
                clientStorages.set(clientId, storage);
                navigator.locks.request(clientId, {}, (lock) => {
                    // When the client tab closes it will release the lock so we can delete the entry.
                    console.log(`Client ${clientId} disconnected from service worker!`);
                    clientStorages.delete(clientId);
                });
                const client = await clients.get(clientId);
                client?.postMessage({ kind: "connected" } as const satisfies ConnectAcknowledge)
            }
            break;
        }
    }
}

export async function serviceWorkerFetch(request: Request, clientId: string, cacheName: string): Promise<Response> {
    // console.log(`fetch ${new URL(request.url).pathname}`);
    const storage = getStorage(clientId);
    let response: Response | undefined;
    if (storage) {
        response = await fetchFromStorage(request, storage);
    }
    if (!response) {
        response = await fetchFromCache(request, cacheName);
    }
    if (!response.ok) {
        console.warn(`HTTP error: ${response.status}, ${response.statusText}`);
    }
    return response;
}

// this global state merely works like a cache and will be recreated if the service worker is restarted.
const clientStorages = new Map<string, OfflineStorage | null>(); // null signifies a storage has been requested but not yet resolved.

async function connectToClient(clientId: string) {
    const client = await clients.get(clientId);
    if (client) {
        client.postMessage({ kind: "connect", clientId } as const satisfies ConnectRequest);
        // console.log(`Connecting to ${clientId} ...`);
    }
}

function getStorage(clientId: string): OfflineStorage | null | undefined {
    let storage = clientStorages.get(clientId);
    if (storage === undefined) {
        storage = null; // mark this client as connecting so we don't connect more than once.
        clientStorages.set(clientId, storage);
        connectToClient(clientId); // fire off the connect message and return null for now. we assume that the regular cache will handle all script files etc. required to process the connect message.
    }
    return storage;
}

async function fetchFromStorage(request: Request, storage: OfflineStorage): Promise<Response | undefined> {
    let response: Response | undefined;
    const entry = storage.requestFormatter.tryDecode(request);
    // Is it an binary asset?
    if (entry) {
        // console.log(`  from storage`);
        // is it an offline asset?
        if (storage.hasDirectory(entry.dir)) {
            // assets are hashed and thus always safe to fetch offline first, regardless of version.
            response = await storage.fetch(request) ?? Response.error();
            if (!response.ok) {
                if (navigator.onLine) {
                    // console.log(`  unavailable offline, fetching online instead`);
                    // fall back to fetching online
                    response = await fetch(request);
                    if (response.ok) {
                        // since this directory is marked for offline, we assume the user wants to cache this file.
                        const buffer = await response.clone().arrayBuffer();
                        if (entry) {
                            const { dir, file } = entry;
                            (await storage.directory(dir)).write(file, buffer);
                        }
                    }
                } else {
                    console.warn(`failed fetch: ${new URL(request.url).pathname}`);
                }
            }
        } else {
            // console.log(`  online only`);
            response = await fetch(request);
        }
    }
    return response;
}

async function fetchFromCache(request: Request, cacheName: string): Promise<Response> {
    let response: Response | undefined;
    // this is a standard browser asset, e.g. script file etc., so we always fetch online first, if available
    if (navigator.onLine) {
        // fetch online to get latest version, or at least the version the cache headers says are safe to get.
        response = await fetch(request);
        const hasQuery = new URL(request.url).search.length > 0;
        if (response.ok && !hasQuery) {
            // add file to cache
            const cache = await caches.open(cacheName);
            // TODO: check dates/etags
            await cache.put(request, response.clone());
        }
    } else {
        // offline, so try to get file from cache instead.
        const cache = await caches.open(cacheName);
        response = await cache.match(request) ?? Response.error();
    }
    return response;
}
