import type { ConnectRequest, ReadRequest, ReadResponse, WriteRequest, WriteResponse } from "./";

const rootPromise = navigator.storage.getDirectory();
const dirHandles = new Map<string, FileSystemDirectoryHandle>();

async function getDirHandle(name: string) {
    let dirHandle = dirHandles.get(name);
    if (!dirHandle) {
        const root = await rootPromise;
        dirHandle = await root.getDirectoryHandle(name, { create: false });
        dirHandles.set(name, dirHandle);
    }
    return dirHandle;
}


export async function handleMainMessage(message: MessageEvent<ConnectRequest | WriteRequest>) {
    const data = message.data;
    // TODO: check out message.ports for ways to communicate directly between service worker and io worker.
    switch (data.kind) {
        case "connect": {
            const { port } = data;
            port.onmessage = handleServiceWorkerMessage(port);
            console.log("io connected!");
            break;
        }
        case "write": {
            let error: string | undefined;
            try {
                await writeFile(data.dir, data.file, data.buffer);
            } catch (ex: any) {
                error = ex.message ?? ex.toString();
            }
            const response: WriteResponse = { kind: "write", id: data.id, error };
            postMessage(response);
            break;
        }
    }
};

function handleServiceWorkerMessage(port: MessagePort) {
    return async function (message: MessageEvent<ReadRequest>) {
        const data = message.data;
        // TODO: check out message.ports for ways to communicate directly between service worker and io worker.
        switch (data.kind) {
            case "read": {
                let buffer: ArrayBuffer | undefined;
                let error: string | undefined;
                try {
                    buffer = await readFile(data.dir, data.file);
                } catch (ex: any) {
                    error = ex.message ?? ex.toString();
                }
                const response: ReadResponse = { kind: "read", id: data.id, buffer, error };
                port.postMessage(response, buffer ? [buffer] : []);
                break;
            }
        }
    };
};

async function readFile(dir: string, filename: string) {
    const dirHandle = await getDirHandle(dir);
    const fileHandle = await dirHandle.getFileHandle(filename, { create: false });
    const file = await fileHandle.getFile();
    return file.arrayBuffer(); // Safari doesn't support transferrable streams
}

async function writeFile(dir: string, file: string, buffer: ArrayBuffer) {
    // console.log(`${dir}/${file}[${buffer.byteLength}]`);
    const dirHandle = await getDirHandle(dir);
    const fileHandle = await dirHandle.getFileHandle(file, { create: true });
    // @ts-ignore
    const accessHandle = await fileHandle.createSyncAccessHandle();
    accessHandle.truncate(buffer.byteLength);
    const bytesWritten = accessHandle.write(new Uint8Array(buffer), { at: 0 });
    console.assert(bytesWritten == buffer.byteLength);
    accessHandle.flush();
    accessHandle.close();
}
