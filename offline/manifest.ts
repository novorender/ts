import type { SceneIndex } from "offline";
import type { OfflineDirectoryOPFS } from "./opfs";

/** An scene manifest entry tuple, consisting of [filename/hash, byteSize]. */
export type SceneManifestEntry = readonly [name: string, size: number];

/** A collection of scene manifest entry tuples, used to construct a scene manifest. */
export interface SceneManifestData {
    readonly webgl2_bin?: readonly SceneManifestEntry[];
    readonly brep?: readonly SceneManifestEntry[];
    readonly db?: readonly SceneManifestEntry[];
};

/** A file manifest for a scene.
 * @remarks
 * A fundamental assumption here is that the file names in the manifest are hashes of the actual content, i.e. same name = same content.
 * If this condition is not met, synchronization will not work!
 */
export class SceneManifest {
    /** A map of manifest filenames and their respective byte sizes. */
    private readonly _glfiles = new Map<string, number>;
    private readonly _brepfiles = new Map<string, number>;
    private readonly _dbfiles = new Map<string, number>;

    // The manifest file entries.
    get glFiles(): IterableIterator<SceneManifestEntry> {
        return this._glfiles.entries();
    }

    get brepFiles(): IterableIterator<SceneManifestEntry> {
        return this._brepfiles.entries();
    }

    get dbFiles(): IterableIterator<SceneManifestEntry> {
        return this._dbfiles.entries();
    }

    get allFiles(): IterableIterator<SceneManifestEntry> {
        const { _glfiles, _brepfiles, _dbfiles } = this;
        function* iterate() {
            yield* _glfiles;
            yield* _brepfiles;
            yield* _dbfiles;
        }
        return iterate();
    }

    /** The total byte size of all the files in this manifest. */
    readonly totalByteSize: number;

    /** The number of files. */
    readonly numFiles: number;

    /**
     * @param data The entries of this manifest.
     */
    constructor(data: SceneManifestData | undefined) {
        const { _glfiles, _brepfiles, _dbfiles } = this;
        let totalByteSize = 0;
        let numFiles = 0;
        if (data) {
            if (data.webgl2_bin) {
                for (const [name, size] of data.webgl2_bin) {
                    _glfiles.set(name, size);
                    totalByteSize += size;
                    numFiles++;
                }
            }
            if (data.brep) {
                for (const [name, size] of data.brep) {
                    _brepfiles.set(name, size);
                    totalByteSize += size;
                    numFiles++;
                }
            }
            if (data.db) {
                for (const [name, size] of data.db) {
                    _dbfiles.set(name, size);
                    totalByteSize += size;
                    numFiles++;
                }
            }
        }
        this.totalByteSize = totalByteSize;
        this.numFiles = numFiles;
    }
}

/**
 * Get an offline file manifest.
 * @param dir The offline directory containing the file manifest.
 * @returns A scene manifest.
 * If the offline directory contains a manifest file, it will be read and returned as a complete manifest.
 * If not, the files in the directory will be enumerated and used to create a partial manifest.
 * The latter case indicates some prior error and is not ideal, but still better than re-downloading every file from scratch.
 */
export async function readManifest(dir: OfflineDirectoryOPFS): Promise<SceneManifest> {
    async function readJson(filename: string): Promise<Object | undefined> {
        const buffer = await dir.read(filename);
        if (buffer) {
            const json = new TextDecoder().decode(buffer);
            try {
                return JSON.parse(json) as Object;
            } catch { }
        }
    }

    let data: SceneManifestData | undefined;
    const index = await readJson("index.json") as SceneIndex | undefined;
    if (index && index.offline) {
        data = await readJson(index.offline.manifest) as SceneManifestData | undefined;
    }
    return new SceneManifest(data);
}

/**
 * Fetch file manifest online.
 * @param request The fetch() API request for the online manifest file.
 */
export async function fetchManifest(request: Request): Promise<SceneManifest> {
    const response = await fetch(request);
    if (!response.ok) {
        throw new Error("Could not fetch manifest!");
    }
    const data = await response.json() as SceneManifestData;
    return new SceneManifest(data);
}
