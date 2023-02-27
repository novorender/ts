import { context } from "esbuild";
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
        ".glsl": "text",
        ".vert": "text",
        ".frag": "text",
    },
}

const ctx = await context(buildOptions);
const server = await ctx.serve(serveOptions);
console.log(`http://${ip.address()}:${server.port}/`);
await server.wait;

