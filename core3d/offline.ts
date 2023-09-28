const offlineDirs = new Map<string, WeakRef<FileSystemDirectoryHandle> | null>();
const rootPromise = navigator.storage.getDirectory();


async function getDirHandle(dirname: string) {
    try {
        const root = await rootPromise;
        return await root.getDirectoryHandle(dirname);
    } catch {
    }
}

/** @internal attempt to read file from OPFS offline storage */
export async function requestOfflineFile(pathname: string): Promise<Response | undefined> {
    const m = /\/([\da-f]{32})(?=\/).*\/(.+)$/.exec(pathname);
    if (m && m.length == 3) {
        const [_, dirname, filename] = m;
        let dirHandleRef = await offlineDirs.get(dirname);
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
                } catch {
                }
            }
        }
    }
    // console.log(`skipping ${pathname}`);
}
