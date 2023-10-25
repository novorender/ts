import type { Logger } from "./";
import type { OfflineViewState } from "./state";
import { SceneManifest, type SceneManifestData, type SceneManifestEntry } from "./manifest";
import type { ResourceType } from "./storage";
import { errorMessage } from "./util";
import type { OfflineDirectoryOPFS } from "./opfs";

/**
 * An offline scene.
 * @remarks
 * This class supports incremental synchronization between offline and online storage.
 * Error and status updates are reported to the {@link logger} property.
 * By default it's undefined, so to display status, events and progress, you must assign your own object implementing the {@link Logger} interface.
 */
export class OfflineScene {
    /** Logger for errors and status updates. */
    logger: Logger | undefined;
    constructor(
        /** The offline context for this scene. */
        readonly context: OfflineViewState,
        /** The storage directory for this scene. */
        readonly dir: OfflineDirectoryOPFS,
        /** The file manifest this scene.
         * @remarks
         * Initially, this may be empty or partial.
         * It may change when the scene is synchronized.
         */
        public manifest: SceneManifest
    ) { }

    /** The scene id. */
    get id() {
        return this.dir.name;
    }

    /** Delete all downloaded files for this scene and remove it from the context's list of offline scenes. */
    async delete() {
        const { dir, context, logger } = this;
        const { scenes } = context;
        const { name } = dir;
        logger?.status("deleting");
        await dir.delete();
        scenes.delete(name);
        context.logger?.status("scene deleted");
        return;
    }

    /**
     * Get total used bytes
     */
    async getUsedSize() {
        const sizes = this.dir.filesSizes();
        let totalUsedSize = 0;
        for await (const size of sizes) {
            if (size) {
                totalUsedSize += size;
            }
        }
        return totalUsedSize;
    }

    /**
     * Reads the manifest file.
     * @param abortSignal A signal to abort downloads/synchronization.
     * @returns Total number of bytes in scene, if it fails it returns undefined
     */
    async readManifest(abortSignal: AbortSignal, sasKey: string) {
        try {
            const data = await this.downloadManifest(abortSignal, sasKey);
            if (data) {
                const manifest = new SceneManifest(data);
                return manifest.totalByteSize;
            }
        }
        catch {
        }
        return undefined;
    }

    private async downloadManifest(abortSignal: AbortSignal, sasKey: string) {
        const { dir, logger, context } = this;
        const { storage } = context;
        logger?.info?.("fetching manifest");
        // fetch online manifest
        const manifestRequest = storage.request(dir.name, "manifest.json", "", sasKey, abortSignal)
        const manifestResponse = await fetch(manifestRequest);
        if (!manifestResponse.ok) {
            logger?.status("invalid format");
            logger?.error(`Failed to retrieve manifest file ${manifestResponse.statusText}`);
            return undefined;
        }
        const manifestData = await manifestResponse.json() as SceneManifestData;
        if (abortSignal.aborted) {
            logger?.status("aborted");
            return undefined;
        }
        return manifestData;
    }

    /**
     * Incrementally synchronize scene files with online storage.
     * @param abortSignal A signal to abort downloads/synchronization.
     * @returns True, if completed successfully, false if not.
     * @remarks
     * Synchronization may be resumed after an abort/failure.
     * It compares the file manifest of local files with the online version and downloads only the difference.
     * Errors are logged in the {@link logger}.
     */
    async sync(abortSignal: AbortSignal, sasKey: string): Promise<boolean> {
        const { dir, manifest, logger, context } = this;
        const { storage } = context;
        if (!navigator.onLine) {
            logger?.status("offline");
            logger?.error("You must be online to synchronize files!");
            return false;
        }

        const existingFiles = new Map<string, number>(manifest.allFiles);
        async function scanFiles() {
            // scan local files in the background, since this could take some time.
            const files = dir.files();
            for await (const filename of files) {
                if (!filename.endsWith(".json")) {
                    existingFiles.set(filename, 0);
                }
            }
        };
        const scanFilesPromise = scanFiles();
        await scanFilesPromise;
        // console.log(`# files: ${existingFiles.size}`);

        try {
            logger?.status("synchronizing");
            let manifestData = await this.downloadManifest(abortSignal, sasKey);
            if (manifestData == undefined) {
                return false;
            }

            this.manifest = new SceneManifest(manifestData);
            const { manifest: onlineManifest } = this;

            const { totalByteSize } = onlineManifest;

            const debounce = debouncer();

            // start incremental download
            logger?.info?.("fetching new files");
            let totalDownload = 0;
            logger?.progress?.(totalDownload, totalByteSize);
            const maxSimulataneousDownloads = 8;
            const downloadQueue = new Array<Promise<void> | undefined>(maxSimulataneousDownloads);

            async function downloadFiles(files: Iterable<SceneManifestEntry>, type: ResourceType) {
                for (const [name, size] of files) {
                    if (!existingFiles.has(name)) {
                        const fileRequest = storage.request(dir.name, name, type, sasKey, abortSignal);
                        let idx = downloadQueue.findIndex(e => !e);
                        if (idx < 0) {
                            // queue is full, so wait for another download to complete
                            await Promise.race(downloadQueue);
                            idx = downloadQueue.findIndex(e => !e);
                            console.assert(idx >= 0);
                        }
                        const downloadPromise = download();
                        downloadQueue[idx] = downloadPromise;
                        downloadPromise.finally(() => {
                            downloadQueue[idx] = undefined;
                        });
                        // do downloads in "parallel"
                        async function download() {
                            let fileResponse = await fetch(fileRequest);
                            if (fileResponse.ok) {
                                const buffer = await fileResponse.arrayBuffer();
                                await dir.write(name, buffer);
                                totalDownload += size;
                            } else {
                                throw new Error(`Could not fetch ${name}!`);
                            }
                        }
                    } else {
                        totalDownload += size;
                    }
                    if (debounce(100)) {
                        logger?.progress?.(totalDownload, totalByteSize);
                    }
                }
            }
            await downloadFiles(onlineManifest.glFiles, "webgl2_bin");
            await downloadFiles(onlineManifest.brepFiles, "brep");
            await Promise.all(downloadQueue);

            logger?.progress?.(undefined, undefined);

            // add manifest to local files last to mark the completion of sync.
            const manifestBuffer = new TextEncoder().encode(JSON.stringify(manifestData)).buffer;
            await dir.write("manifest.json", manifestBuffer);

            // delete unreferenced entries
            logger?.info?.("cleanup");
            for (const [name] of onlineManifest.allFiles) {
                existingFiles.delete(name);
            }
            await dir.deleteFiles(existingFiles.keys());

            logger?.status("synchronized");
            return true;
        } catch (error: unknown) {
            if (typeof error == "object" && error instanceof DOMException && error.code == DOMException.ABORT_ERR) {
                logger?.status("aborted");
            } else {
                logger?.status("error");
                logger?.error(errorMessage(error));
            }
            return false;
        }
    }
}

function debouncer() {
    let prevTime = performance.now();
    return function (minInterval: number) {
        const now = performance.now();
        if (now - prevTime > minInterval) {
            prevTime = now;
            return true;
        } else {
            return false;
        }
    }
}
