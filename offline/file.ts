import { storeOfflineFileSync } from "./worker/file";

const offlineDirs = new Map<string, WeakRef<FileSystemDirectoryHandle> | null>();
const rootPromise = navigator.storage.getDirectory();

// flag to indicate if OPFS async (main thread) is not available (Safari)
let OPFSAsyncWriteSupported = true;

export class OfflineFileNotFoundError extends Error {
    constructor(readonly filename: string) {
        super(`Could not find ${filename} on OPFS storage!`);
    }
}

async function tryGetDirHandle(dirname: string) {
    try {
        const root = await rootPromise;
        return await root.getDirectoryHandle(dirname);
    } catch {
    }
}

/** @internal attempt to read file from OPFS offline storage */
export async function requestOfflineFile(request: Request, cacheFromOnline = true): Promise<Response | undefined> {
    const { pathname } = new URL(request.url);
    const m = /\/([\da-f]{32})(?=\/).*\/(.+)$/i.exec(pathname);
    if (m && m.length == 3) {
        const [_, dirname, filename] = m;
        const dirHandle = await getDirHandle(dirname);
        if (dirHandle) {
            try {
                const fileHandle = await dirHandle.getFileHandle(filename);
                const file = await fileHandle.getFile();
                // console.log(`loading ${filename}`);
                return new Response(file, { status: 200, headers: { "Content-Type": "application/octet-stream" } });
            } catch (error: unknown) {
                if (cacheFromOnline) {
                    const isHashedFileName = /^[\da-f]{32}$/i.test(filename);
                    const fileNotFound = error instanceof DOMException && error.name == "NotFoundError";
                    if (fileNotFound && isHashedFileName) {
                        const isDedicatedWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
                        if (isDedicatedWorker) {
                            const response = await fetch(request);
                            if (response.ok) {
                                // We don't await here so as not to slow down regular online access.
                                // This could cause trouble if file is only partially written next time we try to read it.
                                // Such an access pattern is unlikely in current use cases, however.
                                storeOfflineFileSync(response.clone(), dirHandle, filename);
                            }
                            return response;
                        } else {
                            // We could call storeOfflineFileASync() here, but generally, we don't want to store files accessed from the main thread unless part of a full sync.
                            // Or, put more generally, we don't want to cache anything that's not hashed.
                            // Besides, async writes are not support on safari yet.
                        }
                    }
                }
            }
        }
    }
    // console.log(`skipping ${pathname}`);
}

/** @internal */
export async function hasOfflineDir(dirname: string): Promise<boolean> {
    const dirHandle = await getDirHandle(dirname);
    return !!dirHandle;
}

/** @internal */
export async function getOfflineFile(dirname: string, filename: string): Promise<File> {
    const dirHandle = await getDirHandle(dirname);
    if (!dirHandle)
        throw new Error(`Directory "${dirname}" not found!`);
    try {
        const fileHandle = await dirHandle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return file;
    }
    catch (error: unknown) {
        const fileNotFound = error instanceof DOMException && error.name == "NotFoundError";
        if (fileNotFound) {
            throw new OfflineFileNotFoundError(filename);
        }

        console.error(`${error}, Could not find ${filename} on OPFS storage!`);
        throw error;
    }
}

async function getDirHandle(dirname: string): Promise<FileSystemDirectoryHandle | undefined> {
    let dirHandleRef = await offlineDirs.get(dirname);
    // is this scene marked as offline?
    if (dirHandleRef !== null) {
        let dirHandle = dirHandleRef?.deref();
        if (!dirHandle) {
            dirHandle = await tryGetDirHandle(dirname);
            if (dirHandle) {
                dirHandleRef = new WeakRef(dirHandle);
                offlineDirs.set(dirname, dirHandleRef);
            } else {
                offlineDirs.set(dirname, null);
            }
        }
        return dirHandle;
    }
}

async function storeOfflineFileASync(response: Response, dirHandle: FileSystemDirectoryHandle, filename: string) {
    if (OPFSAsyncWriteSupported) {
        const buffer = await response.clone().arrayBuffer();
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        // async writing doesn't work in safari (yet)
        if ("createWritable" in fileHandle) {
            const writable = await fileHandle.createWritable();
            await writable.write(buffer);
            await writable.close();
        } else {
            OPFSAsyncWriteSupported = false;
            dirHandle.removeEntry(filename);
        }
    }
}
