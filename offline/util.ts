import type { OfflineErrorCode, OfflineErrorMessage } from "./logger";
import { type PathNameFormatter, type PathNameParser, type ResourceType } from "./storage";

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
export function errorMessage(value: unknown, id?: OfflineErrorCode): OfflineErrorMessage {
    function isError(value: any): value is Error {
        return value && "message" in value;
    }
    const message = isError(value) ? value.message : typeof (value) == "string" ? value : (value as any).toString();
    return { message, id };
}

export function* iterateJournal(buffer: Uint8Array) {
    const decoder = new TextDecoder();
    let prevIndex = 0;
    while (prevIndex < buffer.length) {
        let index = buffer.indexOf(10, prevIndex);
        const line = buffer.subarray(prevIndex, index);
        try {
            const text = decoder.decode(line, { stream: true });
            const [name, sizeStr] = text.split(",");
            const size = Number.parseInt(sizeStr);
            if (Number.isNaN(size)) {
                console.warn(`Error reading offline journal: parsed size ${sizeStr} is not a number`);
                break;
            }
            prevIndex = index + 1;
            yield { name, size };
        } catch (ex) {
            console.warn("Error reading offline journal", ex);
            break;
        }
    }
}