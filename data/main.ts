import type { AABB, BoundingSphere } from "core3d";
import { requestOfflineFile } from "offline/file";

export async function loadSceneData(baseUrl: URL, /*id: string, auth: string*/) {
    const signal = undefined;

    // we probably don't want to get these files from online, but it's just here now for consistency.
    // we expect files to already be downloaded as part of offline sync.

    const dbPath = `db/metadata`;
    const dbRequest = new Request(new URL(dbPath, baseUrl), { mode: "cors", signal });
    const dbResponse = await requestOfflineFile(dbRequest) ?? await fetch(dbRequest);
    let db: ArrayBuffer | undefined;
    if (dbResponse.ok) {
        db = await dbResponse.arrayBuffer();
    } else {
        throw new Error(`HTTP Error:${dbResponse.status} ${dbResponse.status}`);
    }

    const lutPath = `db/metadata.lut`;
    const lutRequest = new Request(new URL(lutPath, baseUrl), { mode: "cors", signal });
    const lutResponse = await requestOfflineFile(lutRequest) ?? await fetch(lutRequest);
    let lut: ArrayBuffer | undefined;
    if (lutResponse.ok) {
        lut = await lutResponse.arrayBuffer();
    } else {
        throw new Error(`HTTP Error:${lutResponse.status} ${lutResponse.status}`);
    }

    return new DataContext(db, lut);
}

export interface Bounds {
    readonly box: AABB;
    readonly sphere: BoundingSphere;
}

export interface MetaDataEntry {
    readonly id: number; // object id
    readonly path: string;
    readonly name: string;
    readonly type: NodeType;
    readonly bounds: Bounds;
    readonly properties: readonly [key: string, value: string][];
}

export class DataContext {
    readonly numObjects: number;

    constructor(
        // readonly baseUrl: URL,
        // readonly id: string,
        // readonly auth: string,
        readonly db: ArrayBuffer,
        readonly lut: ArrayBuffer,
    ) {
        this.numObjects = lut.byteLength / 16;
    }

    public async getObjectMetaData(objectIndex: number): Promise<MetaDataEntry> {
        return this.getObjectJsonFromMemory(objectIndex);
    }

    private getObjectJsonFromMemory(objectIndex: number): MetaDataEntry {
        const { db, lut } = this;
        const [offset, length] = new BigUint64Array(lut, objectIndex * 16, 2);
        const utf8Segment = new Uint8Array(db, Number(offset), Number(length));
        const text = new TextDecoder().decode(utf8Segment);
        const json = JSON.parse(text) as MetaDataEntry;
        return json;
    }

    private *getAllObjectJsonsFromMemory(): IterableIterator<MetaDataEntry> {
        const { numObjects, db, lut } = this;
        const decoder = new TextDecoder();
        for (let i = 0; i < numObjects; i++) {
            const [offset, length] = new BigUint64Array(lut, i * 16, 2);
            const utf8Segment = new Uint8Array(db, Number(offset), Number(length));
            const text = decoder.decode(utf8Segment);
            const json = JSON.parse(text) as MetaDataEntry;
            if (json.name.length > 0) {
                yield json;
            }
        }
    }

    private getObjectJsonFromOfflineFiles(objectIndex: number): Promise<MetaDataEntry> {
        // TODO: Implement!
        return undefined! as Promise<MetaDataEntry>;
    }

    private async *getAllObjectJsonsFromOffLineFiles(): AsyncIterableIterator<MetaDataEntry> {
        // TODO: Implement!
    }
}

/*
use cases:
- user clicks object -> display meta data
*/




export interface MetaData {
    readonly properties: Map<string, string>;
}

type ObjectId = number;

/** Lightweight reference to a single object within a scene instance.
     * @remarks
     * Object metadata are not loaded with scene automatically and may require an additional server request. This interface contains only the identity required to perform such a request.
     */
export interface ObjectReference {
    /** The id of the object */
    readonly id: ObjectId;

    /** The instance that contains this object. */
    // readonly instance: Instance;

    /** Load the associated object meta data. */
    loadMetaData(): Promise<ObjectData>;
}

/** Type of node */
export const enum NodeType {
    /** Node has children. */
    Internal = 0,
    /** Node has no children. */
    Leaf = 1,
}

/** Hierarcical object reference to a single object within a scene instance.
 *
 * @remarks
 * This interface extends {@link ObjectReference} with data required for hierachical tree views and 3D rendering without loading the entire set of metadata.
 */
export interface HierarcicalObjectReference extends ObjectReference {
    /** The path of the object expressed as a hierarchical filesystem-like path string. */
    readonly path: string;

    /** Type of node. */
    readonly type: NodeType;

    /** Bounding volume */
    readonly bounds?: {
        // readonly box: AABB;
        readonly sphere: BoundingSphere;
    };
    readonly descendants?: ObjectId[];
}
/** Object metadata.
     */
export interface ObjectData extends HierarcicalObjectReference {
    /** Name of object (typically a GUID from IFC database). */
    readonly name: string;

    /** Description of object (typically from IFC database). */
    readonly description?: string;

    /** Url associated with object */
    readonly url?: string;

    /** String dictionary of any additional metadata properties associated with object */
    properties: [key: string, value: string][];

    /** Save object meta data. */
    save(): Promise<boolean>;
}

