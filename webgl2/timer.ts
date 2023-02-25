import { type EXT_disjoint_timer_query_webgl2_ext, glExtensions } from "./extensions";

export function glCreateTimer(gl: WebGL2RenderingContext, cpuFallback = false): Timer {
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
        if (cpuFallback) {
            return new CPUTimer(gl);
        } else {
            return new NullTimer(gl);
        }
    }
}

export type Timer = NullTimer | CPUTimer | GPUTimer | GPUTimerTS;

class NullTimer {
    readonly kind = "null";
    readonly promise: Promise<number | undefined>;
    readonly creationTime;

    constructor(readonly gl: WebGL2RenderingContext) {
        this.creationTime = performance.now();
        this.promise = Promise.resolve(undefined);
    }

    dispose() { }
    begin() { }
    end() { }
    poll() {
        return true;
    }
}

class CPUTimer {
    readonly kind = "cpu";
    readonly promise: Promise<number | undefined>;
    readonly creationTime;
    private beginTime = 0;
    private endTime = 0;
    private resolve: ((value: number | PromiseLike<number> | undefined) => void) | undefined;

    constructor(readonly gl: WebGL2RenderingContext) {
        this.creationTime = performance.now();
        this.promise = new Promise<number | undefined>(resolve => { this.resolve = resolve; });
    }

    dispose() {
        this.resolve?.(undefined);
        this.resolve = undefined;
    }

    begin() {
        this.gl.getError(); // flush gpu pipeline
        this.beginTime = performance.now();
    }

    end() {
        this.gl.getError(); // flush gpu pipeline
        this.endTime = performance.now();
    }

    poll() {
        this.resolve?.(this.endTime - this.beginTime) // in milliseconds 
        this.resolve = undefined;
        return true;
    }
}

class GPUTimer {
    readonly kind = "gpu_time_elapsed";
    readonly promise: Promise<number | undefined>;
    readonly creationTime;
    private readonly query;
    private resolve: ((value: number | PromiseLike<number> | undefined) => void) | undefined;

    constructor(readonly gl: WebGL2RenderingContext, readonly ext: EXT_disjoint_timer_query_webgl2_ext) {
        this.creationTime = performance.now();
        this.query = gl.createQuery()!;
        this.promise = new Promise<number | undefined>(resolve => { this.resolve = resolve; });
    }

    dispose() {
        const { gl, query, resolve } = this;
        gl.deleteQuery(query);
        resolve?.(undefined);
        this.resolve = undefined;
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
        const { gl, ext, query, resolve } = this;
        let disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (!disjoint) {
            const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
            if (available) {
                const timeElapsed = gl.getQueryParameter(query, gl.QUERY_RESULT) as number; // in nanoseconds
                resolve?.(timeElapsed / 1000000); // in milliseconds
                this.resolve = undefined;
                return true;
            }
        }
        if (performance.now() > this.creationTime + 1000) {
            resolve?.(undefined);
            this.resolve = undefined;
            return true;
        }
        return false;
    }
}


class GPUTimerTS {
    readonly kind = "gpu_timestamp";
    readonly promise: Promise<number | undefined>;
    readonly creationTime;
    private readonly startQuery;
    private readonly endQuery;
    private resolve: ((value: number | PromiseLike<number> | undefined) => void) | undefined;

    constructor(readonly gl: WebGL2RenderingContext, readonly ext: EXT_disjoint_timer_query_webgl2_ext) {
        this.creationTime = performance.now();
        this.startQuery = gl.createQuery()!;
        this.endQuery = gl.createQuery()!;
        this.promise = new Promise<number | undefined>((resolve, reject) => { this.resolve = resolve; });
    }

    dispose() {
        const { gl, startQuery, endQuery, resolve } = this;
        gl.deleteQuery(startQuery);
        gl.deleteQuery(endQuery);
        resolve?.(undefined);
        this.resolve = undefined;
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
        const { gl, ext, startQuery, endQuery, resolve } = this;
        let disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (!disjoint) {
            const available = gl.getQueryParameter(endQuery, gl.QUERY_RESULT_AVAILABLE);
            if (available) {
                const timeStart = gl.getQueryParameter(startQuery, gl.QUERY_RESULT);
                const timeEnd = gl.getQueryParameter(endQuery, gl.QUERY_RESULT);
                const timeElapsed = timeEnd - timeStart; // in nanoseconds
                resolve?.(timeElapsed / 1000000); // in milliseconds
                this.resolve = undefined;
                return true;
            }
        }
        if (performance.now() > this.creationTime + 1000) {
            resolve?.(undefined);
            this.resolve = undefined;
            return true;
        }
        return false;
    }
}
