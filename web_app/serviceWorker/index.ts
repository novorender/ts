// this class helps handle the service worker tasks for offline caching and loading of a scene
export class ServiceWorkerHelper {
    constructor(readonly cache: Cache) {
    }

    async handleMessage(request: ServiceWorkerRequest): Promise<ServiceWorkerResponse> {
        const { kind, sceneUrl } = request;
        switch (kind) {
            case "cache_scene": {
                await this.cacheScene(new URL(sceneUrl));
                const response: CachedSceneResponse = { kind: "cached_scene", sceneUrl, error: undefined };
                return response;
            }
            case "delete_scene": {
                await this.deleteScene(new URL(sceneUrl));
                const response: DeletedSceneResponse = { kind: "deleted_scene", sceneUrl, error: undefined };
                return response;
            }
        }
    }

    async cacheScene(sceneUrl: URL) {
        const manifest = await this.manifest(sceneUrl);
        function* getUrls() {
            for (const file of manifest) {
                // TODO: report progress update
                yield new URL(file, sceneUrl).toString();
            }
        }
        const { cache } = this;
        for (const url of getUrls()) {
            await cache.add(url);
        }
        // await cache.addAll([...getUrls()]);
    }

    async deleteScene(sceneUrl: URL) {
        const { cache } = this;
        const keys = await cache.keys();
        for (const key of keys) {
            const url = new URL(key.url);
            if (url.pathname.startsWith(sceneUrl.pathname)) {
                cache.delete(key);
            }
        }
    }

    async fetch(request: Request): Promise<Response> {
        const { cache } = this;
        const options: CacheQueryOptions = {
            ignoreSearch: true, // SAS keys will change over time but doesn't affect content
        };
        // try cache first
        const isAsset = new URL(request.url).pathname.startsWith("/assets/");
        let response = isAsset ? await cache.match(request, options) : undefined;
        if (!response) {
            try {
                if (isAsset)
                    console.info(`downloading: ${request.url}`);
                // then try online
                response = await fetch(request);
                // if (isAsset) {
                //     await cache.put(request, response.clone()); // update cache
                // }
            } catch (error) {
                console.error(error);
                // console.warn("can't find " + request.url);
                response = new Response(undefined, { status: 408 });
            }
            // } else {
            //     console.log(`cache hit: ${request.url}`);
        }
        return response;
    }

    private async manifest(sceneUrl: URL): Promise<readonly string[]> {
        const fileListResponse = await fetch(new URL("./manifest.json", sceneUrl), { mode: "cors" });
        if (fileListResponse.ok) {
            const files = await fileListResponse.json() as readonly string[];
            return files;
        } else {
            return [];
        }
    }
}

export interface CacheSceneRequest {
    readonly kind: "cache_scene";
    readonly sceneUrl: string;
    readonly port: MessagePort;
}

export interface DeleteSceneRequest {
    readonly kind: "delete_scene";
    readonly sceneUrl: string;
    readonly port: MessagePort;
}

export type ServiceWorkerRequest = CacheSceneRequest | DeleteSceneRequest;

export function isServiceWorkerMessage(request: any): request is ServiceWorkerRequest {
    const kinds: readonly ServiceWorkerRequest["kind"][] = ["cache_scene", "delete_scene"];
    return request && typeof request == "object" && "kind" in request && kinds.includes(request.kind);
}

export interface CachedSceneResponse {
    readonly kind: "cached_scene";
    readonly sceneUrl: string;
    readonly error?: string;
}

export interface DeletedSceneResponse {
    readonly kind: "deleted_scene";
    readonly sceneUrl: string;
    readonly error?: string;
}

export type ServiceWorkerResponse = CachedSceneResponse | DeletedSceneResponse;



// export async function addResourcesToCache(resources: Iterable<string>) {
//     const cache = await caches.open("v1");
//     await cache.addAll(resources);
// };

// export async function putInCache(request: Request, response: Response) {
//     const cache = await caches.open("v1");
//     await cache.put(request, response);
// };

// export async function cacheFirst(request: Request, preloadResponsePromise: Promise<any>, fallbackUrl?: string | URL) {
//     // First try to get the resource from the cache
//     const responseFromCache = await caches.match(request);
//     if (responseFromCache) {
//         return responseFromCache;
//     }

//     // Next try to use (and cache) the preloaded response, if it's there
//     const preloadResponse = await preloadResponsePromise;
//     if (preloadResponse) {
//         console.info("using preload response", preloadResponse);
//         putInCache(request, preloadResponse.clone());
//         return preloadResponse;
//     }

//     // Next try to get the resource from the network
//     try {
//         const responseFromNetwork = await fetch(request);
//         // response may be used only once
//         // we need to save clone to put one copy in cache and serve second one
//         putInCache(request, responseFromNetwork.clone());
//         return responseFromNetwork;
//     } catch (error) {
//         if (fallbackUrl) {
//             const fallbackResponse = await caches.match(fallbackUrl);
//             if (fallbackResponse) {
//                 return fallbackResponse;
//             }
//         }
//         // when even the fallback response is not available, there is nothing we can do, but we must always return a Response object
//         return new Response("Network error happened", {
//             status: 408,
//             headers: { "Content-Type": "text/plain" },
//         });
//     }
// };

// // Enable navigation preload
// export async function enableNavigationPreload() {
//     if (self.registration.navigationPreload) {
//         await self.registration.navigationPreload.enable();
//     }
// };

// self.addEventListener("activate", (event: ExtendableEvent) => {
//     event.waitUntil(enableNavigationPreload());
// });

// self.addEventListener("install", (event: ExtendableEvent) => {
//     event.waitUntil(
//         addResourcesToCache([
//             "/",
//             "/index.html",
//             "/style.css",
//             "/app.js",
//             "/image-list.js",
//             "/star-wars-logo.jpg",
//             "/gallery/bountyHunters.jpg",
//             "/gallery/myLittleVader.jpg",
//             "/gallery/snowTroopers.jpg",
//         ])
//     );
// });

// self.addEventListener("fetch", (event: FetchEvent) => {
//     event.respondWith(
//         cacheFirst(event.request, event.preloadResponse, "/gallery/myLittleVader.jpg")
//     );
// });
