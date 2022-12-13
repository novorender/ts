import { LoaderHandler } from "./loader_handler";
import type { MessageRequest } from "./loader_handler";

const handler = new LoaderHandler();

onmessage = e => {
    const msg = e.data as MessageRequest;
    if (msg.kind == "close") {
        close();
    }
    handler.handleMessage(msg)?.then(({ response, transfer }) => {
        postMessage(response, { transfer });
    });
};

// const downloader = new Downloader();
// const downloads = new Map<string, AbortableDownload>();

// export async function load(params: LoadMessage) {
//     const { url, id, version, byteSize, separatePositionsBuffer } = params;
//     let response: MessageResponse = { kind: "aborted", id } as const satisfies AbortedMessage;
//     const transfer: Transferable[] = [];
//     try {
//         const download = downloader.downloadArrayBufferAbortable(url, new ArrayBuffer(byteSize));
//         downloads.set(id, download);
//         const buffer = await download.result;
//         if (buffer) {
//             downloads.delete(id);
//             const { childInfos, geometry } = parseNode(id, separatePositionsBuffer, version, buffer);
//             response = { kind: "loaded", id, childInfos, geometry } as const satisfies LoadedMessage;
//             for (const { vertexBuffer, indices, positionBuffer } of geometry.subMeshes) {
//                 transfer.push(vertexBuffer);
//                 if (typeof indices != "number") {
//                     transfer.push(indices.buffer);
//                 }
//                 if (positionBuffer) {
//                     transfer.push(positionBuffer);
//                 }
//             }
//         }
//     } catch (error) {
//         response = { kind: "error", id, error } as const satisfies ErrorMessage;
//     }
//     postMessage(response, { transfer });
// }

// function abort(params: AbortMessage) {
//     const { id } = params;
//     const download = downloads.get(id);
//     downloads.delete(id);
//     download?.abort();
// }

// function abortAll(params: AbortAllMessage) {
//     for (const download of downloads.values()) {
//         download.abort();
//     }
//     downloads.clear();
// }