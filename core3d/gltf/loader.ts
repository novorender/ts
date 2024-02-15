import * as GLTF from "./types";

async function request(url: URL, abortController?: AbortController) {
    const signal = abortController?.signal;
    const response = await fetch(url.toString(), { mode: "cors", signal });
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}: ${response.statusText} (${url})`);
    }
    return response;
}

async function downloadJson(url: URL, abortController?: AbortController) {
    const response = await request(url, abortController);
    return await response.json();
}

async function downloadArrayBuffer(url: URL, abortController?: AbortController) {
    const response = await request(url, abortController);
    return await response.arrayBuffer();
}

async function downloadBlob(url: URL, abortController?: AbortController) {
    const response = await request(url, abortController);
    return await response.blob();
}

const BINARY_HEADER_MAGIC = 'glTF';
const BINARY_HEADER_LENGTH = 12;
const BINARY_CHUNK_TYPES = { JSON: 0x4E4F534A, BIN: 0x004E4942 };

/** @internal */
export function parseGLB(data: ArrayBuffer) {
    const headerView = new DataView(data, 0, BINARY_HEADER_LENGTH);
    const decoder = new TextDecoder();

    const header = {
        magic: decoder.decode(new Uint8Array(data, 0, 4)),
        version: headerView.getUint32(4, true),
        length: headerView.getUint32(8, true),
    };

    if (header.magic !== BINARY_HEADER_MAGIC) {
        throw new Error('Unsupported glTF-Binary header.');
    } else if (header.version < 2.0) {
        throw new Error('Unsupported legacy gltf file detected.');
    }

    let json: string | undefined;
    let buffer: ArrayBuffer | undefined;
    const chunkView = new DataView(data, BINARY_HEADER_LENGTH);
    let chunkIndex = 0;
    while (chunkIndex < chunkView.byteLength) {
        const chunkLength = chunkView.getUint32(chunkIndex, true); chunkIndex += 4;
        const chunkType = chunkView.getUint32(chunkIndex, true); chunkIndex += 4;
        if (chunkType === BINARY_CHUNK_TYPES.JSON) {
            const contentArray = new Uint8Array(data, BINARY_HEADER_LENGTH + chunkIndex, chunkLength);
            json = decoder.decode(contentArray);
            json = json.substring(0, json.lastIndexOf("}") + 1);
        } else if (chunkType === BINARY_CHUNK_TYPES.BIN) {
            const contentArray = new Uint8Array(data, BINARY_HEADER_LENGTH + chunkIndex, chunkLength);
            const binaryChunk = new Uint8Array(chunkLength);
            binaryChunk.set(contentArray);
            buffer = binaryChunk.buffer;
        }
        chunkIndex += chunkLength; // Clients must ignore chunks with unknown types.
    }

    if (!json) {
        throw new Error('glTF-Binary: JSON content not found.');
    }
    if (!buffer) {
        throw new Error('glTF-Binary: Binary chunk not found.');
    }
    return { json, buffer };
}

/** @internal */
export async function loadData(url: URL, abortController?: AbortController, extension?: "gltf" | "glb") {
    const path = url.pathname.toLowerCase();
    let gltf: GLTF.GlTf;
    let buffers: ArrayBuffer[];
    if (path.endsWith(".gltf") || extension === "gltf") {
        gltf = await downloadJson(url) as GLTF.GlTf;
        // fetch binary buffer(s)
        const bufferPromises = (gltf.buffers ?? []).map(async buf => {
            const bufferUrl = new URL(buf.uri!, url);
            if (!bufferUrl.search)
                bufferUrl.search = url.search ?? "";
            return downloadArrayBuffer(bufferUrl, abortController);
        });
        buffers = await Promise.all(bufferPromises);
    } else if (path.endsWith(".glb") || extension === "glb") {
        const glb = await downloadArrayBuffer(url, abortController);
        const { json, buffer } = parseGLB(glb);
        gltf = JSON.parse(json) as GLTF.GlTf;
        buffers = [buffer];
    } else {
        throw new Error(`Unknown GLTF file extension: "${url}"!`);
    }
    const imageBlobPromises = gltf.images?.map(img => {
        if (img.uri) {
            const imageUrl = new URL(img.uri, url);
            return downloadBlob(imageUrl, abortController);
        }
    }) ?? [];
    const externalImageBlobs = await Promise.all(imageBlobPromises);
    return { gltf, buffers, externalImageBlobs };
}
