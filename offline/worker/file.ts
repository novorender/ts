/// <reference lib="webworker" />
// call from dedicated worker scope only!
export async function storeOfflineFileSync(response: Response, dirHandle: FileSystemDirectoryHandle, filename: string) {
    const buffer = await response.clone().arrayBuffer();
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const file = await fileHandle.createSyncAccessHandle();
    try {
        file.write(new Uint8Array(buffer));
        file.close();
    } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            file.close();
            dirHandle.removeEntry(filename);
        }
        throw e;
    }
}
