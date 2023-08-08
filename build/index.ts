import { copySourceFiles } from "./sources";
import { declarations } from "./declarations";
import { bundle } from "./bundle";
import { posix } from "path";

export async function build(distFolder?: string) {
    const dist = posix.resolve(distFolder ?? "dist");

    console.log("Copying source files...");
    await copySourceFiles("dist");

    console.log("Emitting typescript declaration files...");
    await declarations(dist);

    console.log("Generating javascript bundles...");
    await bundle(dist);

    console.log("Success!");
}