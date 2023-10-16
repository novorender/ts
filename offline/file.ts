const offlineDirs = new Map<string, WeakRef<FileSystemDirectoryHandle> | null>();
const rootPromise = navigator.storage.getDirectory();

// flag to indicate if OPFS async (main thread) is not available (Safari)
let OPFSAsyncWriteSupported = true;

async function getDirHandle(dirname: string) {
    try {
        const root = await rootPromise;
        return await root.getDirectoryHandle(dirname);
    } catch {
    }
}

/** @internal attempt to read file from OPFS offline storage */
export async function requestOfflineFile(request: Request): Promise<Response | undefined> {
    const { pathname } = new URL(request.url);
    const m = /\/([\da-f]{32})(?=\/).*\/(.+)$/.exec(pathname);
    if (m && m.length == 3) {
        const [_, dirname, filename] = m;
        let dirHandleRef = await offlineDirs.get(dirname);
        // is this scene marked as offline?
        if (dirHandleRef !== null) {
            let dirHandle = dirHandleRef?.deref();
            if (!dirHandle) {
                dirHandle = await getDirHandle(dirname);
                if (dirHandle) {
                    dirHandleRef = new WeakRef(dirHandle);
                    offlineDirs.set(dirname, dirHandleRef);
                } else {
                    offlineDirs.set(dirname, null);
                }
            }
            if (dirHandle) {
                try {
                    const fileHandle = await dirHandle.getFileHandle(filename);
                    const file = await fileHandle.getFile();
                    // console.log(`loading ${filename}`);
                    return new Response(file, { status: 200, headers: { "Content-Type": "application/octet-stream" } });
                } catch (error: unknown) {
                    const fileNotFound = error instanceof DOMException && error.name == "NotFoundError";
                    if (fileNotFound) {
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
                        }
                    }
                }
            }
        }
    }
    // console.log(`skipping ${pathname}`);
}

// call from dedicated worker scope only!
async function storeOfflineFileSync(response: Response, dirHandle: FileSystemDirectoryHandle, filename: string) {
    const buffer = await response.clone().arrayBuffer();
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const file = await fileHandle.createSyncAccessHandle();
    file.write(new Uint8Array(buffer));
    file.close();
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
