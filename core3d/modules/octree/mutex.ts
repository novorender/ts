const enum State { unlocked, locked };

/** @internal */
export class Mutex {
    readonly _view: Int32Array;

    constructor(buffer: SharedArrayBuffer) {
        this._view = new Int32Array(buffer, 0, 1);
    }

    // will loop until lock is available, so be careful using this in main thread
    lockSpin() {
        const { _view } = this;
        for (; ;) {
            if (Atomics.compareExchange(_view, 0, State.unlocked, State.locked) == State.unlocked) {
                return;
            }
        }
    }

    // blocking call, use in workers only!
    lockSync() {
        console.assert(self.Worker != undefined);
        const { _view } = this;
        for (; ;) {
            if (Atomics.compareExchange(_view, 0, State.unlocked, State.locked) == State.unlocked) {
                return;
            }
            Atomics.wait(_view, 0, State.locked);
        }
    }

    // safe to use from main thread
    async lockAsync() {
        const { _view } = this;
        for (; ;) {
            if (Atomics.compareExchange(_view, 0, State.unlocked, State.locked) == State.unlocked) {
                return;
            }
            const { async, value } = Atomics.waitAsync(_view, 0, State.locked);
            if (async) {
                await value;
            }
        }
    }

    unlock() {
        const { _view } = this;
        if (Atomics.compareExchange(_view, 0, State.locked, State.unlocked) != State.locked) {
            throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
        }
        Atomics.notify(_view, 0);
    }
}