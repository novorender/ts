
import { createOPFSStorage, type OfflineStorageOPFS } from "./opfs";
import { createOfflineViewState } from "./state";
import type { ConnectAcknowledge, ConnectRequest, ConnectResponse } from "./opfs/messages";

/** @internal The current storage schema version. */
export const schemaVersion = "1.0";

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
