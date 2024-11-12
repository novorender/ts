

/// <reference lib="webworker" />
// call from dedicated worker scope only!
export async function storeOfflineFileSync(response: Response, dirHandle: FileSystemDirectoryHandle, filename: string) {
    const buffer = await response.clone().arrayBuffer();
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });

    const file = await fileHandle.createSyncAccessHandle();
    let journalBytesWritten = 0;
    let bytesWritten = 0;
    try {
        bytesWritten = file.write(new Uint8Array(buffer));
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
    if (bytesWritten > 0) {
        const journalHandle = await dirHandle.getFileHandle("journal", { create: true });
        let journalFile: FileSystemSyncAccessHandle | undefined;
        for (let i = 0; i < 20; ++i) {
            try {
                journalFile = await journalHandle.createSyncAccessHandle();
                break;
            }
            catch { }
        }
        if (!journalFile) {
            console.warn("Could not open journal file.");
            return;
        }

        const oldJournalSize = journalFile.getSize();
        try {
            const text = `${filename},${bytesWritten}\n`;
            const bytes = new TextEncoder().encode(text);
            journalBytesWritten = journalFile.write(bytes, { at: journalFile.getSize() });
            journalFile.close();
        }
        catch (e: unknown) {
            try {
                if (journalBytesWritten > 0) {
                    journalFile.truncate(oldJournalSize);
                }
                journalFile.close();
                dirHandle.removeEntry(filename);
            } catch (e2) {
                console.warn("Error closing/removing file after failed write", e2);
            }
            throw e;
        }
    }

}
