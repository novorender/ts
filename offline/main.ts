
import { createOPFSStorage, type OfflineStorageOPFS } from "./opfs";
import { createOfflineViewState } from "./state";
import type { ConnectAcknowledge, ConnectRequest, ConnectResponse } from "./opfs/messages";

/** @internal The current storage schema version. */
export const schemaVersion = "1.0";


/** Offline context object. */
export interface OfflineContext {
    /** I/O Worker for OPFS file access. */
    readonly ioWorker: Worker | undefined;

    /** Disable offline support. */
    dispose(): void;
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
export async function enableOffline(serviceWorkerUrl: URL | undefined, ioWorkerUrl: URL | undefined, sasKey?: string): Promise<OfflineContext | undefined> {
    const ioWorker = ioWorkerUrl ? new Worker(ioWorkerUrl, { type: "module", name: "IO" }) : undefined;
    const dispose = await enableServiceWorker(serviceWorkerUrl, ioWorker, sasKey);
    return { ioWorker, dispose } as const satisfies OfflineContext;
}

async function enableServiceWorker(serviceWorkerUrl: URL | undefined, ioWorker: Worker | undefined, sasKey?: string) {
    let disable = () => { }; // don't do anything here by default.
    if (serviceWorkerUrl) {
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
                            ioWorker.postMessage({ kind: "connect", port: port1 } as const satisfies ConnectResponse, [port1]);
                            controller.postMessage({ kind: "connect", port: port2 } as const satisfies ConnectResponse, [port2]);
                            break;
                        }
                        case "connected": {
                            connectedResolve();
                            break;
                        }

                    }
                }
                // await connect request from service worker
                disable = await disablePromise;
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
    }
    return disable;
}

/**
 * Manage offline storage.
 * @param ioWorker The I/O worker for OPFS access.
 * @returns An offline view state context used for offline storage management UI.
 * @internal
 */
export async function manageOfflineStorage(ioWorker: Worker) {
    const storage = await createOPFSStorage(schemaVersion, ioWorker)
    // The context is for UI. The engine only needs the storage itself.
    const context = await createOfflineViewState(storage);
    return context;
}

/**
 * Create an OPFS based offline storage.
 * @param worker The OPFS IO worker, either directly from main thread, or indirectly from service worker. (Safari doesn't support OPFS directly from service worker).
 * @returns An offline context used for offline storage management UI.
 * @internal
 */
export async function createOPFSOfflineStorage(worker: Worker | MessagePort): Promise<OfflineStorageOPFS> {
    const storage = await createOPFSStorage(schemaVersion, worker);
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
