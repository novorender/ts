class SortedIterator {
    currentValue = -1;

    constructor(private readonly iterator: Iterator<number>) {
        this.next();
    }

    next() {
        const { value } = this.iterator.next();
        this.currentValue = value;
        return value != undefined;
    }
}


class IndexedIterator extends SortedIterator {
    constructor(iterator: Iterator<number>, readonly index: number) {
        super(iterator);
    }
}

// this functon returns all the numbers from the input collections in ascending order
// the numbers in each input iterator must be sorted in ascending order and should be unique, i.e. not appear in any of the other collections
export function* mergeSorted(iterators: Iterable<Iterator<number> | undefined>) {
    const activeIterators = [...iterators].map((it, i) => new IndexedIterator(it!, i)).filter(it => it.currentValue != undefined);
    while (activeIterators.length > 0) {
        let minValue = Number.MAX_SAFE_INTEGER;
        let minIdx: number | undefined;
        for (let i = 0; i < activeIterators.length; i++) {
            const iterator = activeIterators[i];
            const currentGroupObjectId = iterator.currentValue;
            if (minValue > currentGroupObjectId) {
                minValue = currentGroupObjectId;
                minIdx = i;
            }
        }
        if (minIdx == undefined) {
            throw new Error("merge sorted error!"); // are input numbers sorted in ascending order?
        }
        const minIterator = activeIterators[minIdx];
        yield { value: minValue, sourceIndex: minIterator.index } as const;
        if (!minIterator.next()) { // iterate iterator one step forward
            activeIterators.splice(minIdx, 1); // remove iterator if we reached the end
        }
    }
}

export function* iterateArray(array: ArrayLike<number>) {
    for (let i = 0; i < array.length; i++) {
        yield array[i];
    }
}

export function* filterSortedInclude(source: Iterable<number>, filter: Iterable<number>) {
    const it = new SortedIterator(filter[Symbol.iterator]());
    for (const value of source) {
        while (it.currentValue != undefined && value > it.currentValue) {
            it.next();
        }
        if (value == it.currentValue) {
            yield value;
        }
    }
}

export function* filterSortedExclude(source: Iterable<number>, filter: Iterable<number>) {
    const it = new SortedIterator(filter[Symbol.iterator]());
    for (const value of source) {
        while (it.currentValue != undefined && value > it.currentValue) {
            it.next();
        }
        if (value != it.currentValue) {
            yield value;
        }
    }
}

