import type { OfflineDirectory } from "./storage";

/** An scene manifest entry tuple, consisting of [filename/hash, byteSize]. */
export type SceneManifestEntry = readonly [name: string, size: number];

/** A collection of scene manifest entry tuples, used to construct a scene manifest. */
export type SceneManifestData = Iterable<SceneManifestEntry>;

/** A file manifest for a scene.
 * @remarks
 * A fundamental assumption here is that the file names in the manifest are hashes of the actual content, i.e. same name = same content.
 * If this condition is not met, synchronization will not work!
 */
export class SceneManifest {
    /** A map of manifest filenames and their respective byte sizes. */
    private readonly _files = new Map<string, number>;

    // The manifest file entries.
    get files(): IterableIterator<SceneManifestEntry> {
        return this._files.entries();
    }

    /** The total byte size of all the files in this manifest. */
    readonly totalByteSize: number;

    /** The number of files. */
    readonly numFiles: number;

    /**
     * @param data The entries of this manifest.
     */
    constructor(data: SceneManifestData) {
        const { _files } = this;
        let totalByteSize = 0;
        let numFiles = 0;
        for (const [name, size] of data) {
            _files.set(name, size);
            totalByteSize += size;
            numFiles++;
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
export async function readManifest(dir: OfflineDirectory): Promise<SceneManifest> {
    let data: SceneManifestData = [];
    const buffer = await dir.read("manifest.json");
    if (buffer) {
        const json = new TextDecoder().decode(buffer);
        data = JSON.parse(json) as SceneManifestEntry[];
    }
    return new SceneManifest(data);
}

/**
 * Fetch file manifest online.
 * @param request The fetch() API request for the online "manifest.json" file.
 */
export async function fetchManifest(request: Request): Promise<SceneManifest> {
    const response = await fetch(request);
    if (!response.ok) {
        throw new Error("Could not fetch manifest!");
    }
    const data = await response.json() as SceneManifestData;
    return new SceneManifest(data);
}
