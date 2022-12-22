declare module "*.glsl" {
    const shader: string;
    export default shader;
}

declare module "*.vert" {
    const shader: string;
    export default shader;
}

declare module "*.frag" {
    const shader: string;
    export default shader;
}

declare module "*.wasm" {
    const data: Uint8Array;
    export default data;
}

declare module "*.worker.js" {
    const createWorker: () => Worker;
    export default createWorker;
}

declare module "*.bin" {
    const data: Uint8Array;
    export default data;
}

