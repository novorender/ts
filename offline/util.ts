import { type PathNameFormatter, type PathNameParser, RequestFormatter } from "./storage";

/**
 * Create a request formatter for the standard novorender cloud/blob storage.
 */
export function defaultRequestFormatter(folder: string = "webgl2_bin") {
    const re = new RegExp(`^\/(?<dir>[0-9a-f]{32})\/${folder}\/(?<file>.+)$`);
    const parser: PathNameParser = (str) => (str.match(re)?.groups as ReturnType<PathNameParser>);
    const formatter: PathNameFormatter = (dir, file) => (`/${dir}/${folder}/${file}`);
    const baseUrl = new URL("https://blobs.novorender.com/");
    return new RequestFormatter(baseUrl, parser, formatter, "cors");
}

/**
 * Utility function to extract error message from an exception, if any.
 * @param value The exception
 * @returns Error.message, if "message" exists, value.toString() if not.
 */
export function errorMessage(value: unknown): string {
    function isError(value: any): value is Error {
        return value && "message" in value;
    }
    return isError(value) ? value.message : typeof (value) == "string" ? value : (value as any).toString();
}

