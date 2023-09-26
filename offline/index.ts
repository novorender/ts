import { createCacheStorage } from "./cache";
import { createOPFSStorage } from "./opfs";
import { OfflineViewState, createOfflineViewState } from "./state";
import type { OfflineStorage } from "./storage";
import { defaultRequestFormatter } from "./util";
import type { ConnectAcknowledge, ConnectRequest, ConnectResponse } from "./opfs/messages";

export * from "./serviceWorker";
export type { Logger } from "./logger";
export type { OfflineScene } from "./scene";
export { createCacheStorage, createOfflineViewState, defaultRequestFormatter, type OfflineViewState };

/** @internal The current storage schema version. */
export const schemaVersion = "1.0";


/** Offline context object. */
export interface OfflineContext {
    /** Disable offline support. */
    disable(): void;

    /**
     * Manage offline storage.
     * @returns An offline view state context used for offline storage management UI.
     */
    manage(): Promise<OfflineViewState>;
}

/**
 * Enable offline support
 * @param serviceWorkerUrl The url to the service worker script, preferably at the root of the domain.
 * @param ioWorker The I/O worker for OFPS access, or undefined to fall back to Cache API instead.
 * @param sasKey The secure access signature (SAS) key used to access scene assets online.
 * @param abortSignal An abort signal for disabling/aborting offline support.
 * @returns A an offline context if successful, undefined otherwise.
 * @remarks
 * Offline won't work in incognito mode.
 * The first time this function is called, the service worker may not be activated, in which case this function also returns false.
 * If so, you must reload your page to activate it.
 * 
 * Note that Cache API doesn't work well on chrome for large scenes with tens of thousands of files or more.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
 */
export async function enableOffline(serviceWorkerUrl: URL, ioWorker: Worker | undefined, sasKey: string | undefined): Promise<OfflineContext | undefined> {
    let context: OfflineContext | undefined;
    if ("serviceWorker" in navigator) {
        const { serviceWorker } = navigator;
        const { controller } = serviceWorker;
        if (ioWorker && controller) {
            let disableResolve: (arg: () => void) => void = undefined!;
            let connectedResolve: () => void = undefined!;
            let disablePromise = new Promise<() => void>(resolve => {
                disableResolve = resolve;
            });
            let connectedPromise = new Promise<void>(resolve => {
                connectedResolve = resolve;
            });
            // handle connect messages
            serviceWorker.onmessage = async (event: MessageEvent<ConnectRequest | ConnectAcknowledge>) => {
                const { data } = event;
                switch (data.kind) {
                    case "connect": {
                        const { clientId } = data;
                        navigator.locks.request(clientId, { ifAvailable: true }, lock => {
                            if (lock) {
                                const promise = new Promise<void>((resolve) => {
                                    disableResolve(resolve);
                                }); // sit on this lock until this tab/client closes or the returned disable() function is called.
                                return promise;
                            } else {
                                console.warn(`Could not obtain service worker client lock ${clientId}!`);
                            }
                        });
                        // respond and hook up service and IO worker.
                        const channel = new MessageChannel();
                        const { port1, port2 } = channel;
                        ioWorker.postMessage({ kind: "connect", port: port1, sasKey } as const satisfies ConnectResponse, [port1]);
                        controller.postMessage({ kind: "connect", port: port2, sasKey } as const satisfies ConnectResponse, [port2]);
                        break;
                    }
                    case "connected": {
                        connectedResolve();
                        break;
                    }

                }
            }
            // await connect request from service worker
            const disable = await disablePromise;
            const manage = async () => {
                return await manageOfflineStorage(ioWorker, sasKey);
            }
            context = { disable, manage } as const;
            // await acknowledgement from service worker
            await connectedPromise;
            console.log("Service worker connected!");
        }

        // register service worker.
        if (navigator.onLine) {
            try {
                await registerServiceWorker(serviceWorkerUrl);
            } catch (error: unknown) {
                console.warn(`Service worker registration failed: ${error}`); // 
            }
        }
        // const registration = await navigator.serviceWorker.ready;
        // const registration = await navigator.serviceWorker.getRegistration();
    } else {
        console.warn(`Service worker is not supported!`); // private/incognito mode?
    }
    return context;
}

/**
 * Manage offline storage.
 * @param ioWorker The I/O worker for OPFS access.
 * @param sasKey A shared access signature key for access to the online storage.
 * @returns An offline view state context used for offline storage management UI.
* @remarks
 * If defined, the sas key is applied to the end of each request uri as a query string.
 * It should not look include the `?` character itself.
 * @internal
 */
async function manageOfflineStorage(ioWorker: Worker | undefined, sasKey?: string) {
    const storage = ioWorker ?
        await createOPFSStorage(schemaVersion, defaultRequestFormatter(sasKey), ioWorker) :
        await createCacheStorage(schemaVersion, defaultRequestFormatter(sasKey));
    // The context is for UI. The engine only needs the storage itself.
    const context = await createOfflineViewState(storage);
    return context;
}

/**
 * Create a cache based offline storage.
 * @param sasKey A shared access signature key for access to the online storage.
 * @returns An offline context used for offline storage management UI.
 * @remarks
 * If defined, the sas key is applied to the end of each request uri as a query string.
 * It should not look include the `?` character itself.
 * @internal
 */
export async function createCacheOfflineStorage(sasKey?: string): Promise<OfflineStorage> {
    const storage = await createCacheStorage(schemaVersion, defaultRequestFormatter(sasKey));
    return storage;
}

/**
 * Create an OPFS based offline storage.
 * @param worker The OPFS IO worker, either directly from main thread, or indirectly from service worker. (Safari doesn't support OPFS directly from service worker).
 * @param sasKey A shared access signature key for access to the online storage.
 * @returns An offline context used for offline storage management UI.
 * @remarks
 * If defined, the sas key is applied to the end of each request uri as a query string.
 * It should not look include the `?` character itself.
 * @internal
 */
export async function createOPFSOfflineStorage(worker: Worker | MessagePort, sasKey?: string): Promise<OfflineStorage> {
    const storage = await createOPFSStorage(schemaVersion, defaultRequestFormatter(sasKey), worker);
    return storage;
}

async function registerServiceWorker(url: URL) {
    try {
        const registration = await navigator.serviceWorker.register(url, { type: "module", updateViaCache: "none" });
        if (registration.installing) {
            // console.log("Service worker installing");
            // const promise = new Promise<void>(resolve => {
            //     navigator.serviceWorker.oncontrollerchange = () => {
            //         resolve();
            //     };
            // });
            // await promise; // wait for controller to become active
        } else if (registration.waiting) {
            // console.log("Service worker installed");
        }
        // const r = await navigator.serviceWorker.ready;
        return registration;
    } catch (error) {
        console.error(`Registration failed with ${error}`);
    }
}
