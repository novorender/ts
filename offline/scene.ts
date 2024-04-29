import { OfflineErrorCode, type Logger } from "./";
import type { OfflineViewState } from "./state";
import { SceneManifest, type SceneManifestData, type SceneManifestEntry } from "./manifest";
import type { ResourceType } from "./storage";
import { errorMessage } from "./util";
import type { OfflineDirectoryOPFS } from "./opfs";
import { requestOfflineFile } from "./file";

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

    /** Get the scene id. */
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
     * Get total number of used bytes.
     * @remarks
     * This file will scan through all the offline files to sum of their total size,
     * which can take a long time to complete.
     * Use manifest data instead if a valid manifest if available.
     */
    async getUsedSize() {
        const sizes = this.dir.filesSizes();
        let totalUsedSize = this.manifest.totalByteSize;
        for await (const size of sizes) {
            if (size) {
                totalUsedSize += size;
            }
        }
        return totalUsedSize;
    }

    /**
     * Reads the manifest file.
     * @param manifestUrl The url to the offline manifest, with sas key.
     * @param abortSignal A signal to abort downloads/synchronization.
     * @returns Total number of bytes in scene, if it fails it returns undefined
     */
    async readManifest(manifestUrl: URL, abortSignal: AbortSignal) {
        try {
            const data = await this.downloadManifest(manifestUrl, abortSignal);
            if (data) {
                const manifest = new SceneManifest(data);
                return manifest.totalByteSize;
            }
        }
        catch {
        }
        return undefined;
    }

    private async downloadManifest(manifestUrl: URL, signal: AbortSignal) {
        const { logger, context } = this;
        const { storage } = context;
        const { mode } = storage;
        logger?.info?.("fetching manifest");
        // fetch manifest, either offline (hashed), or online
        const manifestRequest = new Request(manifestUrl, { mode, signal });
        // const manifestResponse = await requestOfflineFile(manifestRequest) ?? await fetch(manifestRequest);
        const manifestResponse = await fetch(manifestRequest); // always fetch online (for now)
        if (!manifestResponse.ok) {
            logger?.status("invalid format");
            logger?.error(errorMessage(`Failed to retrieve manifest file ${manifestResponse.statusText}`));
            return undefined;
        }
        const manifestData = await manifestResponse.json() as SceneManifestData;
        if (signal.aborted) {
            logger?.status("aborted");
            return undefined;
        }
        return manifestData;
    }

    /**
     * Incrementally synchronize scene files with online storage.
     * @param sceneIndexUrl The url to the scene index.json file, complete with sas key.
     * @param abortSignal A signal to abort downloads/synchronization.
     * @returns True, if completed successfully, false if not.
     * @remarks
     * Synchronization may be resumed after an abort/failure.
     * It compares the file manifest of local files with the online version and downloads only the difference.
     * Errors are logged in the {@link logger}.
     */
    async sync(sceneIndexUrl: URL, abortSignal: AbortSignal): Promise<boolean> {
        const { dir, manifest, logger, context } = this;
        const { storage } = context;
        if (!navigator.onLine) {
            logger?.status("offline");
            logger?.error(errorMessage("You must be online to synchronize files!", OfflineErrorCode.offline));
            return false;
        }

        const sasKey = sceneIndexUrl.search ? sceneIndexUrl.search.substring(1) : undefined;
        const sceneIndexResponse = await fetch(sceneIndexUrl, { mode: "cors", signal: abortSignal });
        if (!sceneIndexResponse.ok) {
            throw new Error(`HTTP error: ${sceneIndexResponse.status}!`);
        }
        const sceneIndex = await sceneIndexResponse.json();
        const { offline } = sceneIndex;
        const manifestUrl = new URL(sceneIndexUrl);
        let idx = sceneIndexUrl.pathname.lastIndexOf("/");
        if (idx >= 0) {
            manifestUrl.pathname = sceneIndexUrl.pathname.slice(0, idx + 1);
        }
        const manifestName = offline.manifest;
        manifestUrl.pathname += manifestName;
        const debounce = debouncer();

        const existingFiles = new Map<string, number>(manifest.allFiles);

        logger?.status("scanning");
        const entries = await dir.getJournalEntries();
        for (const { name, size } of entries) {
            existingFiles.set(name, size);
            if (debounce(1000)) {
                logger?.progress?.(existingFiles.size, undefined, "scan");
            }
        }

        try {
            logger?.status("synchronizing");
            let manifestData = await this.downloadManifest(manifestUrl, abortSignal);
            if (manifestData == undefined) {
                return false;
            }

            const onlineManifest = new SceneManifest(manifestData);
            const { totalByteSize } = onlineManifest;


            // start incremental download
            logger?.info?.("fetching new files");
            let totalDownload = 0;
            logger?.progress?.(totalDownload, totalByteSize, "download");
            const maxSimulataneousDownloads = 8;
            const downloadQueue = new Array<Promise<void> | undefined>(maxSimulataneousDownloads);
            const maxErrors = 100;
            const maxQuotaExceededErrors = 5;
            let quotaExceededErrorCount = 0;
            const errorQueue: { name: string, size: number }[] = [];

            async function downloadFiles(files: Iterable<SceneManifestEntry>, type: ResourceType) {
                for (let retry = 0; retry < 3; retry++) {
                    async function downloadFile(name: string, size: number) {
                        const fileRequest = storage.request(dir.name, name, type, sasKey);
                        let idx = downloadQueue.findIndex(e => !e);
                        if (idx < 0) {
                            // queue is full, so wait for another download to complete
                            await Promise.race(downloadQueue);
                            idx = downloadQueue.findIndex(e => !e);
                            console.assert(idx >= 0);
                        }
                        const downloadPromise = download(size);
                        downloadQueue[idx] = downloadPromise;
                        downloadPromise.finally(() => {
                            downloadQueue[idx] = undefined;
                        });
                        // do downloads in "parallel"
                        async function download(size: number) {
                            try {
                                let fileResponse = await fetch(fileRequest);
                                if (fileResponse.ok) {
                                    if (size > 10_000_000) {
                                        const stream = await fileResponse.body;
                                        if (stream) {
                                            const addBytes = (bytes: number) => {
                                                totalDownload += bytes;
                                                if (debounce(100)) {
                                                    logger?.progress?.(totalDownload, totalByteSize, "download");
                                                }
                                            };
                                            await dir.writeStream(name, stream, size, abortSignal, addBytes);
                                        }
                                    } else {
                                        const buffer = await fileResponse.arrayBuffer();
                                        await dir.write(name, buffer);
                                        totalDownload += size;
                                    }
                                } else {
                                    errorQueue.push({ name, size });
                                }
                                if (abortSignal.aborted) {
                                    throw new DOMException("Download aborted!", "AbortError");
                                }
                            } catch (error: unknown) {
                                if (typeof error == "object" && error instanceof DOMException && error.name == "AbortError") {
                                    throw error;
                                }
                                if (typeof error == "object" && error instanceof Error && error.name === "QuotaExceededError") {
                                    throw error;
                                }
                                
                                errorQueue.push({ name, size });
                            }
                        }
                    }

                    for (const [name, size] of files) {
                        if (errorQueue.length > maxErrors) {
                            break;
                        }

                        if (!existingFiles.has(name)) {
                            try {
                                await downloadFile(name, size);
                            } catch (error) {
                                if (typeof error == "object" && error instanceof Error && error.name === "QuotaExceededError") {
                                    quotaExceededErrorCount++;
                                    if (quotaExceededErrorCount > maxQuotaExceededErrors) {
                                        throw new DOMException("Not enough disk space", "QuotaExceededError");
                                    }
                                } else {
                                    throw error;
                                }
                            }
                        } else {
                            totalDownload += size;
                        }
                        if (debounce(100)) {
                            logger?.progress?.(totalDownload, totalByteSize, "download");
                        }
                    }
                    if (errorQueue.length == 0) {
                        break;
                    }
                    // attempt to re-download failed files.
                    const errors = [...errorQueue];
                    errorQueue.length = 0;
                    await Promise.all(downloadQueue);
                    for (const error of errors) {
                        await downloadFile(error.name, error.size);
                    }
                }
            }
            await downloadFiles(onlineManifest.glFiles, "webgl2_bin");
            await downloadFiles(onlineManifest.brepFiles, "brep");
            await downloadFiles(onlineManifest.dbFiles, "db");
            await Promise.all(downloadQueue);

            logger?.progress?.(totalByteSize, totalByteSize, "download");

            // add manifest.
            const manifestBuffer = new TextEncoder().encode(JSON.stringify(manifestData)).buffer;
            await dir.write(manifestName, manifestBuffer); // TODO: use hashed version?

            if (errorQueue.length > 0) {
                throw new Error(`Failed to download ${errorQueue.length} files!`);
            }

            // add index.json to local files last to mark the completion of sync.
            const indexBuffer = new TextEncoder().encode(JSON.stringify(sceneIndex)).buffer;
            await dir.write("index.json", indexBuffer);

            // only update current manifest after all files have been successfully written
            this.manifest = onlineManifest;

            // TODO: Check quirks related to hashed manifest etc...

            // delete unreferenced entries
            logger?.info?.("cleanup");
            for (const [name] of onlineManifest.allFiles) {
                existingFiles.delete(name);
            }
            existingFiles.delete(manifestName);
            await dir.deleteFiles(existingFiles.keys());

            logger?.status("synchronized");
            return true;
        } catch (error: unknown) {
            if (typeof error == "object" && error instanceof DOMException && error.name == "AbortError") {
                logger?.status("aborted");
            } else {
                logger?.status("error");
                let id: OfflineErrorCode | undefined;
                if (error instanceof DOMException && error.name === "QuotaExceededError") {
                    id = OfflineErrorCode.quotaExceeded;
                }
                logger?.error(errorMessage(error, id));
            }
            return false;
        }
    }
}

function debouncer() {
    let prevTime = Date.now();
    return function (minInterval: number) {
        const now = Date.now();
        if (now - prevTime > minInterval) {
            prevTime = now;
            return true;
        } else {
            return false;
        }
    }
}
