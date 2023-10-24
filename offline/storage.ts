/**
 * Callback function to parse URL path name into directory and file name.
 */
export type PathNameParser = (path: string) => { readonly dir: string, readonly file: string } | undefined;

export type ResourceType = "webgl2_bin" | "brep" | "";

/**
 * Callback function to formatdirectory and file name into an URL path name.
 */
export type PathNameFormatter = (dir: string, file: string, type: ResourceType) => string;

