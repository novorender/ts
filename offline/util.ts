import { type PathNameFormatter, type PathNameParser, RequestFormatter, type ResourceType } from "./storage";

/**
 * Create a request formatter for the standard novorender cloud/blob storage.
 */
// export function defaultRequestFormatter() {
//     const re = new RegExp(`^\/(?<dir>[0-9a-f]{32})${type ? `\/${type}` : ""}\/(?<file>.+)$`);
//     const parser: PathNameParser = (str) => (str.match(re)?.groups as ReturnType<PathNameParser>);
//     const formatter: PathNameFormatter = (dir, file, type: ResourceType) => (`/${dir}${type ? `/${type}` : ""}/${file}`);
//     const baseUrl = new URL("https://blobs.novorender.com/");
//     return new RequestFormatter(baseUrl, parser, formatter, "cors");
// }

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

