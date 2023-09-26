import { type PathNameFormatter, type PathNameParser, RequestFormatter } from "./storage";

/**
 * Create a request formatter for the standard novorender cloud/blob storage.
 * @param sasKey A shared access signature key for access to the online storage.
 */
export function defaultRequestFormatter(sasKey?: string) {
    const re = /^\/(?<dir>[0-9a-f]{32})\/webgl2_bin\/(?<file>.+)$/;
    const parser: PathNameParser = (str) => (str.match(re)?.groups as ReturnType<PathNameParser>);
    const formatter: PathNameFormatter = (dir, file) => (`/${dir}/webgl2_bin/${file}`);
    const baseUrl = new URL("https://blobs.novorender.com/");
    return new RequestFormatter(baseUrl, parser, formatter, sasKey, "cors");
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

