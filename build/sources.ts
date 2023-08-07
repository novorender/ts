import { resolve, dirname, normalize, posix, relative } from "path";
import { stat, mkdir, copyFile, cp, readdir, rm, writeFile } from "fs/promises";
import * as packageInfo from "../package.json";

async function copyFiles(target: string, paths: readonly string[]) {
    await mkdir(target, { recursive: true });
    for (const filePath of paths) {
        const fileName = posix.basename(filePath);
        await copyFile(filePath, `${target}/${fileName}`);
    }
}

async function copyDir(sourceDir: string, targetDir: string) {
    const include = [
        /\.(?:ts|glsl|vert|frag)$/, // source files
        /^tsconfig\.json$/, // important for resolving library types
    ];
    // const exclude = [
    //     /^\./, // any file/folder starting with dot.
    //     /\.(?:bin|png|wasm|zig|json|(?:d\..*ts)|)$/, // non-source files
    //     /^package.json$/
    // ];
    function filter(source: string): boolean {
        return include.some(re => re.test(source));
    }

    const entries = await readdir(normalize(sourceDir), { withFileTypes: true, recursive: true });
    const files = entries.filter(e => (e.isFile() && filter(e.name))).map(e => relative(sourceDir, resolve(e.path, e.name)));
    const dirs = new Set<string>();
    for (const file of files) {
        if (filter(file)) {
            const dir = dirname(file);
            if (!dirs.has(dir)) {
                dirs.add(dir);
                const targetAbsDir = resolve(targetDir, dir);
                await mkdir(targetAbsDir, { recursive: true });
            }
            const sourceFile = resolve(sourceDir, file);
            const targetFile = resolve(targetDir, file);
            await copyFile(sourceFile, targetFile)
        }
    }

    // const entries = await readdir(sourceDir, { withFileTypes: true });
    // const subDirs = entries.filter(e => e.isDirectory());
    // const files = entries.filter(e => { return e.isFile() && filter(e.name) });
    // console.log(sourceDir);
    // let hasFiles = false;
    // for (const { name } of subDirs) {
    //     hasFiles ||= await copyDir(resolve(sourceDir, name), resolve(targetDir, name));
    // }
    // if (files.length) {
    //     await mkdir(targetDir, { recursive: true });
    //     for (const { name } of files) {
    //         await copyFile(resolve(sourceDir, name), resolve(targetDir, name));
    //     }
    //     hasFiles = true;
    // }
    // return hasFiles;
}

async function copyDirs(target: string, paths: readonly string[]) {
    // await mkdir(target, { recursive: true });


    for (const path of paths) {
        await copyDir(resolve(path), resolve(target, path));
    }

    // for (const dirPath of paths) {
    //     const dirName = basename(dirPath);
    //     await cp(dirPath, `${target}/${dirName}`, { recursive: true, force: true, filter });
    // }
}

async function emptyDir(dir: string) {
    if (await stat(dir)) {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const { path } of entries) {
            await rm(path, { recursive: true, force: true });
        };
    } else {
        await mkdir(dir);
    }
}

async function writeIndexDeclaration(dir: string) {
    await mkdir(posix.resolve(dir, "types"));
    await writeFile(posix.resolve(dir, "types/index.d.ts"), `export * from "./web_app";`);
}

async function writePackageJson(dir: string) {
    const data: any = {
        "name": "@novorender/web_app",
        "version": packageInfo.version,
        "description": "Novorender web app API.",
        "browser": "./index.js",
        "types": "./types/index.d.ts",
        "type": "module",
        "scripts": {},
        "repository": {
            "type": "git",
            "url": "git+https://github.com/novorender/ts.git"
        },
        "author": "Novorender AS",
        "license": "MIT",
        "bugs": {
            "url": "https://github.com/novorender/ts/issues"
        },
        "homepage": "https://novorender.com",
        "peerDependencies": {
            "typescript": "^5.1.6",
            "tslib": "^2.6.1",
            "gl-matrix": "^3.4.3"
        }
    };
    const json = JSON.stringify(data, undefined, "  ");
    await writeFile(posix.resolve(dir, "package.json"), json);
}

export async function copySourceFiles(distFolder?: string) {
    const dirName = posix.resolve(distFolder ?? "dist");
    await emptyDir(dirName);
    await copyDirs(dirName, ["web_app", "core3d", "webgl2"]);
    await copyFiles(dirName, ["tsconfig.json"]);
    await copyFiles(posix.resolve(dirName, "public"), ["core3d/wasm/main.wasm", "core3d/lut_ggx.png", "core3d/modules/watermark/logo.bin"]);
    await writeIndexDeclaration(dirName);
    await writePackageJson(dirName);
    // TODO: apply template transformations on readme.md
    return dirName;
}
