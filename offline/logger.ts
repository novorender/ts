
/** 
 * An interface for reporting status updates, progress and errors to UI.
 * @remarks
 * Loggers report updates to their associated object, e.g. an offline context or an individual offline scene.
 */
export interface Logger {
    /**
     * Update the current status of object, intended for permanent display.
     * @param state The new state of object, e.g. "ready", "error" or "completed".
     */
    status(state: string): void;

    /**
     * Log an informational message, mostly intended for diagnostics.
     * @param message: The message to be displayed.
     */
    info?(message: string): void;

    /**
     * Log an error message.
     * @param message: The error message to be displayed.
     */
    error(message: OfflineErrorMessage): void;

    /**
     * Update progress for potentially long running processes, such as synchronization.
     * @param value The progress as a factor between 0 and {@link max}.
     * @param max The maximum value, or `undefined` if value is also undefined.
     * @param operation The operation currently being progressed.
     */
    progress?(value: number, max: number | undefined, operation: "scan" | "download"): void;
}

/**
 * Offline error message
 */
export interface OfflineErrorMessage {
    /**
     * Human readable error message
     */
    message: string;
    /**
     * Possible error type if it can be provided
     */
    id?: OfflineErrorCode;
}

/**
 * Offline error code
 */
export enum OfflineErrorCode {
    /**
     * Device disk drive quota exceeded
     */
    quotaExceeded,
    /**
     * Device is offline
     */
    offline
}