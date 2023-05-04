export class Benchmark {
    readonly canvas;
    readonly gl;
    static readonly size = 1024;
    static readonly numPixels = Benchmark.size * Benchmark.size;

    constructor() {
        const options: WebGLContextAttributes = {
            alpha: true,
            antialias: false,
            depth: false,
            desynchronized: false,
            failIfMajorPerformanceCaveat: true,
            powerPreference: "high-performance",
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            stencil: false,
        };

        const { size } = Benchmark;
        // const canvas = this.canvas = new OffscreenCanvas(size, size);
        const canvas = this.canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        canvas.style.backgroundColor = "red";
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.right = "0";
        canvas.style.bottom = "0";
        canvas.style.zIndex = "10";
        document.body.appendChild(canvas);
        const gl = canvas.getContext("webgl2", options);
        if (!gl)
            throw new Error("Unable to create WebGL 2 context!");
        this.gl = gl;
    }

    dispose() {
        const { gl, canvas } = this;
        document.body.removeChild(canvas);
        const ext = gl.getExtension("WEBGL_lose_context");
        ext?.loseContext();
    }
}
