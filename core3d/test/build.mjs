import { serve, buildSync } from "esbuild";
import ip from "ip";

const serveOptions = {
    servedir: "./",
    port: 8080,
}

const buildOptions = {
    entryPoints: {
        main: 'main.ts',
    },
    sourcemap: true,
    minify: false,
    bundle: true,
    platform: "browser",
    target: ["esnext"],
    format: "esm",
    external: ["./node_modules/*"],
    outdir: "./dist",
    loader: {
        ".wasm": "binary",
        ".glsl": "text",
        ".vert": "text",
        ".frag": "text",
    },
}

// buildSync(buildOptions);
const server = await serve(serveOptions, buildOptions);
console.log(`http://${ip.address()}:${server.port}/`);
await server.wait;

