/// <reference lib="webworker" />
// call from dedicated worker scope only!
export async function storeOfflineFileSync(response: Response, dirHandle: FileSystemDirectoryHandle, filename: string) {
    const buffer = await response.clone().arrayBuffer();
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const file = await fileHandle.createSyncAccessHandle();
    file.write(new Uint8Array(buffer));
    file.close();
}
