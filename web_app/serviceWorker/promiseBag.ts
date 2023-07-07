export class PromiseBag<T = void> {
    private readonly promises = new Map<number, PendingPromise<T>>();
    private currentId = 0;

    newId(): number {
        const id = this.currentId++;
        this.currentId &= 0xffff; // wrap around to avoid overflow
        return id;
    }

    create(id: number): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.promises.set(id, { resolve, reject });
        });
    }

    resolve(id: number, result: T | Error) {
        const { promises } = this;
        const pendingPromise = promises.get(id);
        if (pendingPromise) {
            promises.delete(id);
            const { resolve, reject } = pendingPromise;
            if (!isError(result)) {
                resolve(result);
            } else {
                reject(result);
            }
        }
    }
}

function isError(result: any): result is Error {
    return result && typeof result == "object" && result instanceof Error;
}

interface PendingPromise<T> {
    resolve(value: T): void;
    reject(reason: any): void;
}

