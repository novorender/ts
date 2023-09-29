import { resolve, dirname, normalize, posix, relative } from "path";
import { stat, mkdir, copyFile, cp, readFile, readdir, rm, writeFile } from "fs/promises";
import * as packageJson from "../package.json";
import ejs from "ejs";

async function copyFiles(target: string, paths: readonly (string | readonly [string, string])[]) {
    await mkdir(target, { recursive: true });
    for (const file of paths) {
        const filePath = Array.isArray(file) ? file[0] : file;
        const fileName = Array.isArray(file) ? file[1] : posix.basename(filePath);
        await copyFile(filePath, `${target}/${fileName}`);
    }
}

async function getFileRecursive(sourceDir: string, files: string[]) {
    const entries = await readdir(normalize(sourceDir), { withFileTypes: true });
    for (const entry of entries) {
        const path = resolve(sourceDir, entry.name);
        if (entry.isFile()) {
            files.push(path);
        } else {
            await getFileRecursive(path, files);
        }
    }
}

async function copyDir(sourceDir: string, targetDir: string) {
    const include = [
        /\.(?:ts|js|glsl|vert|frag)$/, // source files
        /tsconfig\.json$/, // important for resolving library types
    ];
    function filter(source: string): boolean {
        return include.some(re => re.test(source));
    }

    const paths: string[] = [];
    await getFileRecursive(sourceDir, paths);
    const files = paths.filter(path => (filter(path))).map(path => relative(sourceDir, resolve(path)));

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
            await copyFile(sourceFile, targetFile);
        }
    }
}

async function copyDirs(target: string, paths: readonly string[]) {
    for (const path of paths) {
        await copyDir(resolve(path), resolve(target, path));
    }
}

async function exists(dir: string) {
    try {
        await stat(dir);
        return true;
    } catch (error: unknown) {
        return false;
    }
}

async function emptyDir(dir: string) {
    if (await exists(dir)) {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const { name } of entries) {
            await rm(resolve(dir, name), { recursive: true, force: true });
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
        "name": "@novorender/api",
        "version": packageJson.version,
        "description": "Novorender web API.",
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
    const json = JSON.stringify(data, undefined, 2);
    await writeFile(posix.resolve(dir, "package.json"), json);
}

async function writeReadme(dirName: string) {
    const data = { packageJson };
    const template = await readFile(posix.resolve("README.md"), { encoding: 'utf8' });
    const readme = ejs.render(template, data, {});
    await writeFile(posix.resolve(dirName, "README.md"), readme);
}

export async function copySourceFiles(dirName: string) {
    await emptyDir(dirName);
    await copyDirs(dirName, ["web_app", "core3d", "webgl2", "measure", "offline"]);
    await copyFiles(dirName, ["tsconfig.json"]);
    await copyFiles(posix.resolve(dirName, "public"), [["node_modules/@novorender/wasm-parser/wasm_parser_bg.wasm", "parser.wasm"], "core3d/wasm/main.wasm", "core3d/lut_ggx.png", "core3d/modules/watermark/logo.bin", "measure/wasm/nurbs.wasm"]);
    await writeIndexDeclaration(dirName);
    await writePackageJson(dirName);
    await writeReadme(dirName);
}
