import { type Logger } from "./logger";
import { SceneManifest, readManifest } from "./manifest";
import { OfflineScene } from "./scene";
import { type OfflineStorage } from "./storage";
import { errorMessage } from "./util";

/**
 * Create and initialize an offline view state object.
 * @param storage The offline storage to use.
 */
export async function createOfflineViewState(storage: OfflineStorage) {
    const storageEstimate = "estimate" in navigator.storage ? await navigator.storage.estimate() : undefined;
    const context = new OfflineViewState(storage, storageEstimate);
    const { scenes } = context;
    for (const dir of storage.existingDirectories) {
        const manifest = await readManifest(dir);
        const scene = new OfflineScene(context, dir, manifest);
        scenes.set(dir.name, scene);
    }
    return context;
}

/**
 * Viewstate for offline support UI.
 * @remarks
 * This view state serves as a base offline management UI.
 * The purpose is to view and manage offline scenes, such as updating/synchronizing with newer versions online.
 * A service worker will implement the actual offline support for the engine itself and will use the underlying storage objects for read access only.
 * Error and status updates are reported to the {@link logger} property.
 * By default it's undefined, so to display status, events and progress, you must assign your own object implementing the {@link Logger} interface.
 */
export class OfflineViewState {
    /** Map of active offline scenes */
    readonly scenes = new Map<string, OfflineScene>();

    /** Logger for errors and status updates. */
    logger: Logger | undefined;

    constructor(
        /** The offline storage used. */
        readonly storage: OfflineStorage,
        /** The initially estimated storage usage and quotas, if available. You may use `navigator.estimate()` to get the latest update, although this doesn't necessarily reflect recent changes, hence the term "estimate". See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate) for more details. */
        readonly initialStorageEstimate: StorageEstimate | undefined,
    ) {
    }

    /**
     * Add a new scene to offline storage.
     * @param id: The scene id.
     * @returns The offline scene, or undefined if error.
     * @remarks
     * This function will merely mark the scene as an offline candidate.
     * You need to call {@link OfflineScene.sync} for the scene to be downloaded and ready for offline use.
     * Errors are logged in the {@link logger}.
     */
    async addScene(id: string): Promise<OfflineScene | undefined> {
        const { storage, scenes, logger } = this;
        if (scenes.has(id)) {
            logger?.error("scene already added");
        }
        try {
            // const request = storage.requestFormatter.request(id, "manifest.json");
            // const manifestData = await fetchManifestData(request);
            logger?.status("adding scene");
            const manifest = new SceneManifest([]);
            const dir = await storage.directory(id);
            try {
                const scene = new OfflineScene(this, dir, manifest);
                // const manifestBuffer = new TextEncoder().encode(JSON.stringify(manifestData));
                // scene.dir.write("manifest.json", manifestBuffer);
                scenes.set(id, scene);
                logger?.status("scene added");
                return scene;
            } catch (error: unknown) {
                dir.delete(); // why?
                throw error;
            }
        } catch (error: unknown) {
            logger?.error(errorMessage(error));
        }
    }

    /**
     * Delete all offline data and remove every offline scene.
     * @returns True if success, False if an error occurred.
     * @remarks
     * Errors are logged in the {@link logger}.
     */
    async deleteAll() {
        const { logger, storage, scenes } = this;
        try {
            logger?.status("clearing cache");
            storage.deleteAll();
            // for await (const dir of await storage.directories()) {
            //     await dir.deleteAll();
            // };
            scenes.clear();
            logger?.status("cache cleared");
            return true;
        } catch (error: any) {
            logger?.error(errorMessage(error));
            return false;
        }
    }
}

