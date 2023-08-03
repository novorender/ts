import { defineConfig } from 'tsup'
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';

export default defineConfig({
    entry: ['web_app/index.ts'],
    splitting: false,
    sourcemap: true,
    clean: true,
    loader: {
        ".wasm": "binary",
        ".bin": "binary",
        ".png": "binary",
        ".glsl": "text",
        ".vert": "text",
        ".frag": "text"
    },
    plugins: [inlineWorkerPlugin()],
});
