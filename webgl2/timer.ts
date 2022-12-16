import { EXT_disjoint_timer_query_webgl2_ext, glExtensions } from "./extensions";

export function createTimer(gl: WebGL2RenderingContext): Timer {
    const { disjointTimerQuery } = glExtensions(gl);
    if (disjointTimerQuery) {
        // Clear the disjoint state before starting to work with queries to increase the chances that the results will be valid.
        gl.getParameter(disjointTimerQuery.GPU_DISJOINT_EXT);
        const useTimestamps = gl.getQuery(disjointTimerQuery.TIMESTAMP_EXT, disjointTimerQuery.QUERY_COUNTER_BITS_EXT) ?? 0 > 0;
        if (useTimestamps)
            return new GPUTimerTS(gl, disjointTimerQuery);
        else
            return new GPUTimer(gl, disjointTimerQuery);
    } else {
        // console.log("using cpu timer.")
        return new CPUTimer(gl);
    }
}

export type Timer = CPUTimer | GPUTimer | GPUTimerTS;

class CPUTimer {
    readonly promise: Promise<number>;
    readonly creationTime;
    #begin = 0;
    #end = 0;
    #resolve: ((value: number | PromiseLike<number>) => void) = undefined!;

    constructor(readonly gl: WebGL2RenderingContext) {
        this.creationTime = performance.now();
        this.promise = new Promise<number>(resolve => { this.#resolve = resolve; });
    }

    dispose() {
    }

    begin() {
        this.gl.getError(); // flush gpu pipeline
        this.#begin = performance.now();
    }

    end() {
        this.gl.getError(); // flush gpu pipeline
        this.#end = performance.now();
    }

    poll() {
        this.#resolve(this.#end - this.#begin) // in milliseconds 
        return true;
    }
}

class GPUTimer {
    readonly promise: Promise<number>;
    private readonly query;
    readonly #creationTime;
    #resolve: ((value: number | PromiseLike<number>) => void) = undefined!;
    #reject: ((reason?: any) => void) = undefined!;

    constructor(readonly gl: WebGL2RenderingContext, readonly ext: EXT_disjoint_timer_query_webgl2_ext) {
        this.#creationTime = performance.now();
        this.query = gl.createQuery()!;
        this.promise = new Promise<number>((resolve, reject) => { this.#resolve = resolve; this.#reject = reject; });
    }

    dispose() {
        const { gl, query } = this;
        gl.deleteQuery(query);
    }

    begin() {
        const { gl, ext, query } = this;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    }

    end() {
        const { gl, ext } = this;
        gl.endQuery(ext.TIME_ELAPSED_EXT);
    }

    poll() {
        const { gl, ext, query } = this;
        let disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (!disjoint) {
            const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
            if (available) {
                const timeElapsed = gl.getQueryParameter(query, gl.QUERY_RESULT) as number; // in nanoseconds
                this.#resolve(timeElapsed / 1000000); // in milliseconds
            }
            return true;
        }
        if (performance.now() > this.#creationTime + 1000) {
            this.#reject("timed out!");
            return true;
        }
        return false;
    }
}


class GPUTimerTS {
    readonly promise: Promise<number>;
    private readonly startQuery;
    private readonly endQuery;
    readonly #creationTime;
    #resolve: ((value: number | PromiseLike<number>) => void) = undefined!;
    #reject: ((reason?: any) => void) = undefined!;


    constructor(readonly gl: WebGL2RenderingContext, readonly ext: EXT_disjoint_timer_query_webgl2_ext) {
        this.#creationTime = performance.now();
        this.startQuery = gl.createQuery()!;
        this.endQuery = gl.createQuery()!;
        this.promise = new Promise<number>((resolve, reject) => { this.#resolve = resolve; this.#reject = reject; });
    }

    dispose() {
        const { gl, startQuery, endQuery } = this;
        gl.deleteQuery(startQuery);
        gl.deleteQuery(endQuery);
    }

    begin() {
        const { ext, startQuery } = this;
        ext.queryCounterEXT(startQuery, ext.TIMESTAMP_EXT);
    }

    end() {
        const { ext, endQuery } = this;
        ext.queryCounterEXT(endQuery, ext.TIMESTAMP_EXT);
    }

    poll() {
        const { gl, ext, startQuery, endQuery } = this;
        let disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (!disjoint) {
            const available = gl.getQueryParameter(endQuery, gl.QUERY_RESULT_AVAILABLE);
            if (available) {
                const timeStart = gl.getQueryParameter(startQuery, gl.QUERY_RESULT);
                const timeEnd = gl.getQueryParameter(endQuery, gl.QUERY_RESULT);
                const timeElapsed = timeEnd - timeStart; // in nanoseconds
                this.#resolve(timeElapsed / 1000000); // in milliseconds
                return true;
            }
        }
        if (performance.now() > this.#creationTime + 1000) {
            this.#reject("timed out!");
            return true;
        }
        return false;
    }
}
