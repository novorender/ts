import { build } from "esbuild";
import copyFilesAsync from "copyfiles";
import fs from "fs";
// import * as tsup from "tsup";
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';

async function copyFiles(paths, options) {
    return new Promise((resolve, reject) =>
        copyFilesAsync(paths,
            options ?? {},
            error => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            }
        )
    );
}

// copy source files
await copyFiles(["tsconfig.json", "web_app/**/*", "core3d/**/*", "webgl2/**/*", "dist"]);

// move web_app/package.json to root
fs.renameSync("dist/web_app/package.json", "dist/package.json");

// TODO: copy all other resources to be imported to dist filter
// TODO: use tsc to make .js and .map.js files (and declaration files? - test out in test project)

// const production = process.env.ENV === 'production';

// const buildOptionsIIFE = {
//     entryPoints: {
//         main_iife: 'src/index.ts',
//     },
//     sourcemap: !production,
//     minify: production,
//     bundle: true,
//     platform: "browser",
//     target: ["esnext"],
//     format: "iife",
//     external: [  ],
//     outdir: "build/",
//     globalName: 'NovoMeasure',
// }

const buildOptions = {
    entryPoints: {
        index: 'dist/web_app/index.ts',
        loaderWorker: 'dist/core3d/imports/loader.worker.ts',
        shaders: 'dist/core3d/imports/shaders.ts',
    },
    define: {
        'import.meta.env.NPM_PACKAGE_VERSION': `"${process.env.VERSION ?? process.env.npm_package_version}"`
    },
    sourcemap: true,
    minify: true,
    bundle: true,
    platform: "browser",
    target: ["esnext"],
    format: "esm",
    loader: {
        ".wasm": "binary",
        ".bin": "binary",
        ".png": "binary",
        ".glsl": "text",
        ".vert": "text",
        ".frag": "text"
    },
    plugins: [inlineWorkerPlugin()],
    outdir: './dist/',
}

//await build(buildOptionsIIFE);

await build(buildOptions);

//tsup web_app/index.ts --dts-only

// await tsup.build( {
//   outDir:"dist",
//   format:"esm",
//   entry:"web_app/index.ts",
//   dts:true
// });
