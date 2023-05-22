import {  build} from "esbuild";
import * as path from 'path';
import { Extractor, ExtractorConfig, ExtractorResult } from '@microsoft/api-extractor';
import inlineWorkerPlugin from 'esbuild-plugin-inline-worker';


const production = false;

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
    sourcemap: !production,
    minify: production,
    bundle: true,
    platform: "browser",
    target: ["esnext"],
    format: "esm",
    external: ["./node_modules/*"],
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



const apiExtractorJsonPath  = './api-extractor.json';

// Load and parse the api-extractor.json file
const extractorConfig = ExtractorConfig.loadFileAndPrepare(apiExtractorJsonPath);

// Invoke API Extractor
const extractorResult = Extractor.invoke(extractorConfig, {
  // Equivalent to the "--local" command-line parameter
  localBuild: true,

  // Equivalent to the "--verbose" command-line parameter
  showVerboseMessages: true
});

if (extractorResult.succeeded) {
  console.log(`API Extractor completed successfully`);
  process.exitCode = 0;
} else {
  console.error(
    `API Extractor completed with ${extractorResult.errorCount} errors` +
      ` and ${extractorResult.warningCount} warnings`
  );
  process.exitCode = 1;
}