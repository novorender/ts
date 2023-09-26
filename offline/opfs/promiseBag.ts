/** @internal */
export class PromiseBag {
    private readonly promises = new Map<number, PendingPromise>();
    private currentId = 0;

    newId(): number {
        const id = this.currentId++;
        this.currentId &= 0xffff; // wrap around to avoid overflow
        return id;
    }

    create<T = void>(id: number): Promise<T> {
        return new Promise<T>((resolve) => {
            this.promises.set(id, { resolve });
        });
    }

    resolve(id: number, result: any) {
        const { promises } = this;
        const pendingPromise = promises.get(id);
        if (pendingPromise) {
            promises.delete(id);
            const { resolve } = pendingPromise;
            resolve(result);
        }
    }
}

interface PendingPromise {
    resolve(value: any): void;
}
