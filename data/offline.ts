import { hasOfflineDir, getOfflineFile } from "offline/file";
import type { DataContext, MetaDataEntry } from "./main";
import { streamLines } from "./util";

export async function loadSceneDataOffline(sceneId: string, jsonFilename: string, lutFilename: string): Promise<DataContext | undefined> {
    if (await hasOfflineDir(sceneId)) {
        const jsonFile = await getOfflineFile(sceneId, jsonFilename);
        const lutFile = await getOfflineFile(sceneId, lutFilename);
        return new DataContextOffline(jsonFile, lutFile);
        // return new DataContextOfflineMemory(jsonFile, lutFile);
    }
}

class DataContextOffline implements DataContext {
    readonly utf8Decoder = new TextDecoder();

    constructor(
        readonly jsonFile: File,
        readonly lutFile: File,
    ) {
    }

    async getObjectMetaData(objectIndex: number): Promise<MetaDataEntry> {
        const { lutFile, jsonFile, utf8Decoder } = this;
        const lutBuf = await lutFile.slice(objectIndex * 16, objectIndex * 16 + 16).arrayBuffer();
        const [offset, length] = new BigUint64Array(lutBuf);
        const start = Number(offset);
        const end = start + Number(length);
        const jsonBuf = await jsonFile.slice(start, end).arrayBuffer();
        const utf8Segment = new Uint8Array(jsonBuf);
        const text = utf8Decoder.decode(utf8Segment);
        const json = JSON.parse(text) as MetaDataEntry;
        return json;
    }

    async *allObjectMetaData(): AsyncIterableIterator<MetaDataEntry> {
        const { jsonFile, utf8Decoder } = this;
        const stream = jsonFile.stream();
        for await (const line of streamLines(stream, utf8Decoder)) {
            const json = JSON.parse(line) as MetaDataEntry;
            if (json.name.length > 0) {
                yield json;
            }
        };
    }
}

// This naive implementation is just for reference and should be removed.
class DataContextOfflineMemory implements DataContext {
    readonly utf8Decoder = new TextDecoder();
    readonly lutPromise: Promise<ArrayBuffer>;
    readonly dbPromise: Promise<ArrayBuffer>;

    constructor(
        readonly jsonFile: File,
        readonly lutFile: File,
    ) {
        this.lutPromise = lutFile.arrayBuffer();
        this.dbPromise = jsonFile.arrayBuffer();
    }

    async getObjectMetaData(objectIndex: number): Promise<MetaDataEntry> {
        const { utf8Decoder, dbPromise, lutPromise } = this;
        const db = await dbPromise;
        const lut = await lutPromise;
        const [offset, length] = new BigUint64Array(lut, objectIndex * 16, 2);
        const utf8Segment = new Uint8Array(db, Number(offset), Number(length));
        const text = utf8Decoder.decode(utf8Segment);
        const json = JSON.parse(text) as MetaDataEntry;
        return json;
    }

    async *allObjectMetaData(): AsyncIterableIterator<MetaDataEntry> {
        const { utf8Decoder, dbPromise, lutPromise } = this;
        const db = await dbPromise;
        const lut = await lutPromise;
        const numObjects = lut.byteLength / 16;
        for (let i = 0; i < numObjects; i++) {
            const [offset, length] = new BigUint64Array(lut, i * 16, 2);
            const utf8Segment = new Uint8Array(db, Number(offset), Number(length));
            const text = utf8Decoder.decode(utf8Segment, { stream: true });
            const json = JSON.parse(text) as MetaDataEntry;
            if (json.name.length > 0) {
                yield json;
            }
        }
    }
}
