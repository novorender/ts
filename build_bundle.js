import {  build} from "esbuild";
import * as tsup from "tsup";
import * as path from 'path';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';


const production = process.env.ENV === 'production';

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
        main: 'web_app/index.ts',
    },
    define: {
        'import.meta.env.NPM_PACKAGE_VERSION': `"${process.env.VERSION ?? process.env.npm_package_version}"`
    },
    sourcemap: true,
    minify: production,
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
    outfile: './dist/index.js',
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
