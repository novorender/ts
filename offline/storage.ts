/**
 * Callback function to parse URL path name into directory and file name.
 */
export type PathNameParser = (path: string) => { readonly dir: string, readonly file: string } | undefined;

/**
 * Callback function to formatdirectory and file name into an URL path name.
 */
export type PathNameFormatter = (dir: string, file: string) => string;

/**
 * Offline storage interface
 * @remarks
 * This object offers a basic filesystem-like abstraction for offline storage,
 * either through the Cache API or OPFS API, depending on browser/availability.
 */
export interface OfflineStorage {
    /** The formatter used to encode and decode requests. */
    readonly requestFormatter: RequestFormatter;

    /**
     * Determine if request is a potential offline asset or not.
     * @param request The resource request
     * @returns True, if request url matches that of a potential offline asset, False, if not.
     * @remarks
     * This function only check if the URL matches the pattern of potential offline assets,
     * not if it's actually available offline or not.
     * It's only meant as an early screening to not intercept purely online content.
     */
    isAsset(request: Request): boolean;

    /**
     * Fetch resource from offline storage, if available.
     * @param request The resource request
     * @returns A response or undefined if no match was found.
     */
    fetch(request: Request): Promise<Response | undefined>;

    /** Existing directory names in this storage. */
    existingDirectories: IterableIterator<OfflineDirectory>;

    /** Check if directory already exists. */
    hasDirectory(name: string): boolean;

    /**
     * Get or create a directory by name.
     * @param name The directory name.
     * @returns The directory storage.
     */
    directory(name: string): Promise<OfflineDirectory>;

    /**
     * Delete everything in this storage, including folders using a different/older schema.
     */
    deleteAll(): Promise<void>;
}

/**
 * Offline directory interface.
 * @remarks
 * This objects offers a basic file folder-like abstraction for offline storage.
 */
export interface OfflineDirectory {
    // /** The offline context. */
    // readonly context: OfflineStorage;

    /** The name of this folder. */
    readonly name: string;

    /**
     * Retrive the file names of this directory.
     * @remarks
     * Potentially slow?
     */
    files(): AsyncIterableIterator<string>;

    // /**
    //  * Retrive the byte size of the specified file.
    //  * @param name The file name to query.
    //  */
    // size(name: string): Promise<number>;

    // /**
    //  * Open the specified file as a readable stream.
    //  * @param name The file name to open.
    //  * @returns The file stream, or undefined if file does not exist or the browser doesn't support this operation.
    //  */
    // open(name: string): Promise<ReadableStream | undefined>;

    /**
     * Read the specified file as an ArrayBuffer.
     * @param name The file name to read.
     * @returns The file content, or undefined if file does not exist.
     */
    read(name: string): Promise<ArrayBuffer | undefined>;

    /**
     * Write the content of a file.
     * @param name: The file name to write.
     * @param buffer: The new content of this file.
     * @remarks
     * The input buffer may be transferred to an underlying worker and become inaccessible from the calling thread.
     * Thus, you should pass a copy if you need to retain the original.
     */
    write(name: string, buffer: ArrayBuffer): Promise<void>;

    /**
     * Delete the specified file.
     * @param names The file names to delete.
     */
    deleteFiles(names: IterableIterator<string>): Promise<void>;

    /**
     * Delete folder and everything inside it.
     */
    delete(): Promise<void>;
}

/**
 * Helper class to format directory + filename into fetch() API requests and vice versa.
 */
export class RequestFormatter {
    constructor(
        /** The base url to apply to requests. */
        readonly baseUrl: URL,
        /** The path name parser to use. */
        private readonly parser: PathNameParser,
        /** The path name formatter to use. */
        private readonly formatter: PathNameFormatter,
        /** The query string to apply, e.g. a sas key. */
        readonly query?: string,
        /** The mode flags for request, e.g. "cors". */
        readonly mode?: RequestMode) { }

    /**
     * 
     * @param dir The storage directory name.
     * @param file The storage file name.
     * @param signal A signal for aborting the request.
     * @param applyQuery Whether or not to apply query string to request url.
     * @returns A Request to feed to fetch() API and/or to match against cache entries.
     */
    request(dir: string, file: string, applyQuery = false, signal?: AbortSignal): Request {
        const { baseUrl, formatter, mode, query } = this;
        const url = new URL(formatter(dir, file), baseUrl) + (query && applyQuery ? `?${query}` : "");
        return new Request(url, { mode, signal });
    }

    /**
    * Decode request into directory and file name.
    * @param request A request generated from the {@link request} function.
    * @returns Request directory and file name, if url matches asset pattern, undefined otherwise.
    */
    tryDecode(request: Request) {
        const { parser } = this;
        const { pathname } = new URL(request.url);
        return parser(pathname);
    }

    /**
     * Decode request into directory and file name.
     * @param request A request generated from the {@link request} function.
     * @returns Request directory and file name.
     */
    decode(request: Request) {
        const result = this.tryDecode(request);
        if (!result)
            throw new Error("Request does not match valid pattern!");
        return result;
    }
}
