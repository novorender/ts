import * as build from "./build/index.js";

console.log("Copying source files...");
const dist = await build.copySourceFiles("dist");

console.log("Emitting typescript declaration files...");
await build.declarations(dist);

console.log("Generating javascript bundles...");
await build.bundle(dist);

console.log("Success!");

// import { build } from "esbuild";
// import { basename, resolve } from "path/posix";
// import { stat, mkdir, copyFile, cp, readdir, rm, rename } from "fs/promises";
// import { buildDeclarations } from "./build/index.js";

// async function copyFiles(target, paths) {
//     await mkdir(target, { recursive: true });
//     for (const filePath of paths) {
//         const fileName = basename(filePath);
//         await copyFile(filePath, `${target}/${fileName}`);
//     }
// }

// async function copyDirs(target, paths) {
//     await mkdir(target, { recursive: true });
//     for (const dirPath of paths) {
//         const dirName = basename(dirPath);
//         await cp(dirPath, `${target}/${dirName}`, { recursive: true, force: true });
//     }
// }

// async function emptyDir(dir) {
//     if (await stat(dir)) {
//         const entries = await readdir(dir);
//         for (const entry of entries) {
//             await rm(`${dir}/${entry}`, { recursive: true, force: true });
//         };
//     } else {
//         await mkdir(dir);
//     }
// }

// const dirName = resolve("dist");

// // empty dist folder6
// await emptyDir(dirName);

// // copy source files
// await copyDirs(dirName, ["web_app", "core3d", "webgl2"]);
// await copyFiles(dirName, ["tsconfig.json"]);

// // copy public files
// await copyFiles(resolve(dirName, "/public"), ["core3d/wasm/main.wasm", "core3d/lut_ggx.png", "core3d/modules/watermark/logo.bin"]);

// // move web_app/package.json to root
// await rename(resolve(dirName, "web_app/package.json"), resolve(dirName, "package.json"));

// const transformOptions = {
//     projectBaseDir: dirName,
// };

// const msgs = buildDeclarations(dirName, "tsconfig.json", transformOptions);
// for (const msg of msgs) {
//     console.log(msg);
// }

// const production = process.env.ENV === 'production';


// // const buildOptionsIIFE = {
// //     entryPoints: {
// //         main_iife: 'src/index.ts',
// //     },
// //     sourcemap: !production,
// //     minify: production,
// //     bundle: true,
// //     platform: "browser",
// //     target: ["esnext"],
// //     format: "iife",
// //     external: [  ],
// //     outdir: "build/",
// //     globalName: 'NovoMeasure',
// // }

// // TODO: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

// const buildOptions = {
//     entryPoints: {
//         ["index"]: 'dist/web_app/index.ts',
//         ["public/loaderWorker"]: 'dist/core3d/modules/octree/worker/index.ts',
//         ["public/shaders"]: 'dist/core3d/imports/shaders.ts',
//     },
//     define: {
//         'import.meta.env.NPM_PACKAGE_VERSION': `"${process.env.VERSION ?? process.env.npm_package_version}"`
//     },
//     sourcemap: true,
//     minify: production,
//     bundle: true,
//     platform: "browser",
//     target: ["esnext"],
//     format: "esm",
//     loader: {
//         ".wasm": "file",
//         ".bin": "file",
//         ".png": "file",
//         ".glsl": "text",
//         ".vert": "text",
//         ".frag": "text"
//     },
//     outdir: './dist/',
// }

// //await build(buildOptionsIIFE);

// await build(buildOptions);

// //tsup web_app/index.ts --dts-only

// // await tsup.build( {
// //   outDir:"dist",
// //   format:"esm",
// //   entry:"web_app/index.ts",
// //   dts:true
// // });
