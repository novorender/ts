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
        try {
            file.close();
            dirHandle.removeEntry(filename);
        } catch (e2) {
            console.warn("Error closing/removing file after failed write", e2);
        }
        throw e;
    }
}
