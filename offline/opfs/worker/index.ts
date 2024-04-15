/// <reference lib="webworker" />
import type { AppendStreamResponse, CloseStreamResponse, ConnectResponse, CreateDirResponse, DeleteAllResponse, DeleteDirResponse, DeleteFilesResponse, DirsResponse, FileSizesResponse, FilesResponse, IORequest, IOResponse, OpenStreamResponse, ReadResponse, WriteResponse } from "../messages";
/** @internal Handle messages on behalf of IO worker. */
export async function handleIOWorkerMessages(message: MessageEvent<ConnectResponse | IORequest>) {
    const data = message.data;
    switch (data.kind) {
        case "connect": {
            const { port } = data;
            if (port) {
                // console.log("offline io worker connected!");
                port.onmessage = async (message: MessageEvent<IORequest>) => {
                    // handle I/O messages from service worker
                    const { response, transfer } = await handleIORequest(message.data);
                    if (response) {
                        port.postMessage(response, transfer);
                    }
                }
            }
            break;
        }
        default: {
            // handle I/O messages from main thread
            const { response, transfer } = await handleIORequest(data);
            if (response) {
                self.postMessage(response, { transfer });
            }
            break;
        }
    }
}

const rootPromise = navigator.storage.getDirectory();
const dirHandles = new Map<string, FileSystemDirectoryHandle>();
const journalHandles = new Map<string, LockedHandle>();
const streamHandles = new Map<string, StreamHandle>();

interface StreamHandle {
    readonly accessHandle: FileSystemSyncAccessHandle;
    offset: number;
    readonly size: number;
    readonly file: string;
    readonly dir: string;
}

class LockedHandle {
    constructor(handle: FileSystemSyncAccessHandle) {
        this.handle = handle;
        this.lockPromise = Promise.resolve();
    }

    private lockPromise: Promise<void>;
    private handle: FileSystemSyncAccessHandle;
    async lock() {
        await this.lockPromise;
        let unlock: (() => void) | undefined;
        this.lockPromise = new Promise<void>(resolve => {
            unlock = resolve;
        });
        return { handle: this.handle, unlock: unlock! };
    }
}

async function getDirHandle(name: string) {
    let dirHandle = dirHandles.get(name);
    if (!dirHandle) {
        const root = await rootPromise;
        dirHandle = await root.getDirectoryHandle(name);
        dirHandles.set(name, dirHandle);
    }
    return dirHandle;
}

async function getGetJournalHandle(name: string, reset: boolean) {
    let journalHandle = journalHandles.get(name);
    if (journalHandle && reset) {
        const { handle, unlock } = await journalHandle.lock();
        handle.close();
        unlock();
        journalHandle = undefined;
    }
    if (!journalHandle) {
        const dirHandle = await getDirHandle(name);
        const fileHandle = await dirHandle.getFileHandle("journal", { create: true });
        const accessHandle = await fileHandle.createSyncAccessHandle();
        journalHandle = new LockedHandle(accessHandle);
        journalHandles.set(name, journalHandle);
    }
    return journalHandle;
}


async function closeJournal(name: string) {
    let journalHandle = journalHandles.get(name);
    if (journalHandle) {
        const { handle, unlock } = await journalHandle.lock();
        handle.close();
        const dirHandle = await getDirHandle(name);
        dirHandle.removeEntry("journal");
        unlock();
        journalHandles.delete(name);
    }
    return journalHandle;
}



function exhaustiveGuard(_value: never): never {
    throw new Error(`Unknown IO request message: ${JSON.stringify(_value)}`);
}

interface ResponseMessage {
    readonly response?: IOResponse;
    readonly transfer: Transferable[];
}

async function handleIORequest(data: IORequest): Promise<ResponseMessage> {
    let response: IOResponse | undefined;
    let transfer: Transferable[] = [];
    switch (data.kind) {
        case "create_dir": {
            let error: string | undefined;
            try {
                await createDir(data.dir);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "create_dir", id: data.id, error } as const satisfies CreateDirResponse;
            break;
        }
        case "dirs": {
            let error: string | undefined;
            let dirs: readonly string[] = [];
            try {
                dirs = await dirNames();
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "dirs", id: data.id, dirs, error } as const satisfies DirsResponse;
            break;
        }
        case "files": {
            let error: string | undefined;
            let files: readonly string[] = [];
            try {
                files = await fileNames(data.dir);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "files", id: data.id, files, error } as const satisfies FilesResponse;
            break;
        }
        case "file_sizes": {
            let error: string | undefined;
            let sizes: (number | undefined)[] = [];
            try {
                sizes = await fileSizes(data.dir, data.files);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "file_sizes", id: data.id, sizes, error } as const satisfies FileSizesResponse;
            break;
        }
        case "read": {
            let error: string | undefined;
            let buffer: ArrayBuffer | undefined;
            try {
                buffer = data.file == "journal" ? await readJournal(data.dir) : await readFile(data.dir, data.file);
                if (buffer) {
                    transfer.push(buffer);
                }
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "read", id: data.id, buffer, error } as const satisfies ReadResponse;
            break;
        }
        case "write": {
            let error: string | undefined;
            let errorName: string | undefined;
            try {
                await writeFile(data.dir, data.file, data.buffer);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
                errorName = ex.name;
                console.warn(`${data.file}: ${error}`);
            }
            response = { kind: "write", id: data.id, error, errorName } as const satisfies WriteResponse;
            break;
        }
        case "open_write_stream": {
            let error: string | undefined;
            let errorName: string | undefined;
            try {
                const handle = await createFile(data.dir, data.file, data.size);
                const key = `${data.dir}/${data.file}`;
                streamHandles.set(key, handle);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
                errorName = ex.name;
                console.warn(`${data.file}: ${error}`);
            }
            response = { kind: "open_write_stream", id: data.id, error, errorName } as const satisfies OpenStreamResponse;
            break;
        }
        case "append_stream": {
            let error: string | undefined;
            try {
                const key = `${data.dir}/${data.file}`;
                const handle = streamHandles.get(key);
                if (handle) {
                    await appendfile(handle, data.buffer);
                } else {
                    throw new Error("Handle is not opened!");
                }
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
                console.warn(`${data.file}: ${error}`);
            }
            response = { kind: "append_stream", id: data.id, error } as const satisfies AppendStreamResponse;
            break;
        }

        case "close_write_stream": {
            let error: string | undefined;
            try {
                const key = `${data.dir}/${data.file}`;
                const handle = streamHandles.get(key);
                if (handle) {
                    finalizeFile(handle);
                    streamHandles.delete(key);
                } else {
                    throw new Error("Handle is not opened!");
                }
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
                console.warn(`${data.file}: ${error}`);
            }
            response = { kind: "close_write_stream", id: data.id, error } as const satisfies CloseStreamResponse;
            break;
        }


        case "delete_files": {
            let error: string | undefined;
            try {
                await deleteFiles(data.dir, data.files);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "delete_files", id: data.id, error } as const satisfies DeleteFilesResponse;
            break;
        }
        case "delete_dir": {
            let error: string | undefined;
            try {
                await deleteDir(data.dir);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "delete_dir", id: data.id, error } as const satisfies DeleteDirResponse;
            break;
        }
        case "delete_all": {
            let error: string | undefined;
            try {
                await deleteAll();
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            response = { kind: "delete_all", id: data.id, error } as const satisfies DeleteAllResponse;
            break;
        }
        default: exhaustiveGuard(data);
    }
    return { response, transfer } as const;
};

/** @internal */
export type DirEntryValue = FileSystemDirectoryHandle | FileSystemFileHandle;
/** @internal */
export type DirEntry = readonly [string, DirEntryValue];

async function dirEntries(dir: FileSystemDirectoryHandle): Promise<readonly DirEntry[]> {
    let output: DirEntry[] = [];
    // @ts-expect-error
    const entries: AsyncIterableIterator<DirEntry> = dir.entries(); // this method is not yet included in ts types.
    for await (const entry of entries) { // use Array.fromAsync() instead when it's available in chrome.
        // TODO: filter by type?
        output.push(entry);
    }
    return output;
}

async function createDir(dir: string): Promise<void> {
    const root = await rootPromise;
    await root.getDirectoryHandle(dir, { create: true });
}

async function dirNames(): Promise<readonly string[]> {
    const root = await rootPromise;
    const entries = await dirEntries(root);
    const dirs = entries.filter(([_, value]) => value.kind == "directory").map(([name]) => name);
    return dirs;
}

async function fileNames(dir: string): Promise<readonly string[]> {
    const dirHandle = await getDirHandle(dir);
    const entries = await dirEntries(dirHandle);
    const files = entries.filter(([_, value]) => value.kind == "file").map(([name]) => name);
    return files;
}

async function readFile(dir: string, filename: string) {
    try {
        const dirHandle = await getDirHandle(dir);
        const fileHandle = await dirHandle.getFileHandle(filename);
        const accessHandle = await fileHandle.createSyncAccessHandle();
        const size = accessHandle.getSize();
        const buffer = new Uint8Array(size);
        accessHandle.read(buffer);
        accessHandle.close();
        return buffer.buffer;
    } catch (error: unknown) {
        if (error instanceof DOMException && error.name == "NotFoundError") {
            return undefined;
        } else {
            console.log({ error });
            throw error;
        }
    }
    // const file = await fileHandle.getFile();
    // return file.arrayBuffer(); // Safari doesn't support transferrable streams, so we resort to arraybuffer instead.
}

async function fileSizes(dir: string, files?: readonly string[]) {
    const sizes: (number | undefined)[] = [];
    files ??= await fileNames(dir);
    for (const filename of files) {
        let size: number | undefined;
        try {
            const dirHandle = await getDirHandle(dir);
            const fileHandle = await dirHandle.getFileHandle(filename);
            const accessHandle = await fileHandle.createSyncAccessHandle();
            size = accessHandle.getSize();
            accessHandle.close();
        } catch (error: unknown) {
            if (!(error instanceof DOMException && error.name == "NotFoundError")) {
                console.log({ error });
                throw error;
            }
        }
        sizes.push(size);
    }
    return sizes;
}


async function createFile(dir: string, file: string, size: number): Promise<StreamHandle> {
    const dirHandle = await getDirHandle(dir);
    const fileHandle = await dirHandle.getFileHandle(file, { create: true });
    const accessHandle = await fileHandle.createSyncAccessHandle();
    accessHandle.truncate(size);
    return { accessHandle, offset: 0, dir, file, size };
}

async function appendfile(streamHandle: StreamHandle, buffer: ArrayBuffer) {
    const { accessHandle, offset } = streamHandle;
    const bytesWritten = accessHandle.write(new Uint8Array(buffer), { at: offset });
    console.assert(bytesWritten == buffer.byteLength);
    streamHandle.offset += bytesWritten;
}

async function finalizeFile(streamHandle: StreamHandle) {
    const { accessHandle, offset, dir, file, size } = streamHandle;
    accessHandle.flush();
    accessHandle.close();
    if (size == offset) {
        await appendJournal(dir, file, size);
    }
    else {
        const dirHandle = await getDirHandle(dir);
        dirHandle.removeEntry(file);
    }
}

async function writeFile(dir: string, file: string, buffer: ArrayBuffer) {
    // console.log(`${dir}/${file}[${buffer.byteLength}]`);
    let accessHandle: FileSystemSyncAccessHandle | undefined;
    try {
        const dirHandle = await getDirHandle(dir);
        const fileHandle = await dirHandle.getFileHandle(file, { create: true });
        accessHandle = await fileHandle.createSyncAccessHandle();
        accessHandle.truncate(buffer.byteLength);
        const bytesWritten = accessHandle.write(new Uint8Array(buffer), { at: 0 });
        console.assert(bytesWritten == buffer.byteLength);
        accessHandle.flush();
        await appendJournal(dir, file, bytesWritten);
    } finally {
        accessHandle?.close();
    }

}

async function readJournal(dir: string) {
    let dispose: (() => void) | undefined;
    try {
        const journalHandle = await getGetJournalHandle(dir, true);
        const { handle, unlock } = await journalHandle.lock();
        dispose = unlock;
        const size = handle.getSize();
        const buffer = new Uint8Array(size);
        handle.read(buffer);

        return buffer.buffer;
    } catch (error: unknown) {
        if (error instanceof DOMException && error.name == "NotFoundError") {
            return undefined;
        } else {
            console.log({ error });
            throw error;
        }
    } finally {
        dispose?.();
    }
}

async function appendJournal(dir: string, file: string, size: number) {
    let dispose: (() => void) | undefined;
    try {
        const journalHandle = await getGetJournalHandle(dir, false);
        const { handle, unlock } = await journalHandle.lock();
        dispose = unlock;
        const text = `${file},${size}\n`;
        const bytes = new TextEncoder().encode(text);
        handle.write(bytes, { at: handle.getSize() });
        handle.flush();
    } finally {
        dispose?.();
    }

}

async function deleteFiles(dir: string, files: readonly string[]) {
    const dirHandle = await getDirHandle(dir);
    closeJournal(dir);
    for (const file of files) {
        dirHandle.removeEntry(file);
    }
}

async function deleteDir(dir: string) {
    const root = await rootPromise;
    closeJournal(dir);
    root.removeEntry(dir, { recursive: true });
}

async function deleteAll() {
    const root = await rootPromise;
    const entries = await dirEntries(root);
    for (const [name] of entries) {
        closeJournal(name);
        root.removeEntry(name, { recursive: true });
    }
}

