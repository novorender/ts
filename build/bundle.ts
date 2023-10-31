import { BuildOptions, build } from "esbuild";
import { resolve, relative } from "path/posix";

export async function bundle(outdir: string, production = process.env.ENV == "production") {
    outdir = relative(resolve("."), outdir);
    const buildOptions: BuildOptions = {
        entryPoints: {
            ["index"]: resolve(outdir, "web_app/index.ts"),
            ["public/loaderWorker"]: resolve(outdir, "core3d/modules/octree/worker/index.ts"),
            ["public/shaders"]: resolve(outdir, "core3d/imports/shaders.ts"),
            ["public/measureWorker"]: resolve(outdir, "measure/worker/service.ts"),
            ["public/ioWorker"]: resolve(outdir, "offline/opfs/worker/index.ts"),
        },
        define: {
            'NPM_PACKAGE_VERSION': `"${process.env.VERSION ?? process.env.npm_package_version}"`
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
        outdir,
    }

    const { errors, warnings } = await build(buildOptions);
    for (const error of errors) {
        console.error(error);
    }
    for (const warning of warnings) {
        console.warn(warning);
    }
    if (errors.length > 0) {
        throw new Error("Failed to build javascript bundle!");
    }
}
