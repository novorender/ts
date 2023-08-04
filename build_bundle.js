import { build } from "esbuild";
import path from "path";
import fs from "fs";

function copyFiles(target, paths) {
    fs.mkdirSync(target, { recursive: true });
    for (const filePath of paths) {
        const fileName = path.basename(filePath);
        fs.copyFileSync(filePath, `${target}/${fileName}`);
    }
}

function copyDirs(target, paths) {
    fs.mkdirSync(target, { recursive: true });
    for (const dirPath of paths) {
        const dirName = path.basename(dirPath);
        fs.cpSync(dirPath, `${target}/${dirName}`, { recursive: true });
    }
}

function emptyDir(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(f => {
            fs.rmSync(`${dir}/${f}`, { recursive: true, force: true });
        });
    } else {
        fs.mkdirSync(dir);
    }
}

// empty dist folder
emptyDir("dist");

// copy source files
copyDirs("dist", ["web_app", "core3d", "webgl2"]);
copyFiles("dist", ["tsconfig.json"]);

// copy public files
copyFiles("dist/public", ["core3d/wasm/main.wasm", "core3d/lut_ggx.png", "core3d/modules/watermark/logo.bin"]);

// move web_app/package.json to root
fs.renameSync("dist/web_app/package.json", "dist/package.json");

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
        ["index"]: 'dist/web_app/index.ts',
        ["public/loaderWorker"]: 'dist/core3d/modules/octree/worker/index.ts',
        ["public/shaders"]: 'dist/core3d/imports/shaders.ts',
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
        ".wasm": "file",
        ".bin": "file",
        ".png": "file",
        ".glsl": "text",
        ".vert": "text",
        ".frag": "text"
    },
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
