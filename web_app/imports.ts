import { esbuildImports } from "core3d/imports/esbuild";

/**
 * Download and create the imported resources from the npm package bundle.
 * @param baseUrl Url where to find imported resources, or the url of currently running script if undefined.
 * @returns Imported resources.
 * @remarks
 * This methods assumes all the files in the root of the npm package resides in the {@link baseUrl} folder.
 * Whereas all GLSL shaders are inlined, the other resources are loaded as individual files, albeit in parallel.
 * This should work well on a HTTP/2 server, particularly if you can {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/rel/preload | preload} them.
 * 
 * If you wish to inline some or all of these resources,
 * or fetch them from different locations,
 * you must do so making your own, equivalent function within your bundler/build environment.
 */
export async function getBundledImports(baseUrl?: string) {
    baseUrl ??= (document.currentScript as HTMLScriptElement | null)?.src ?? import.meta.url; // use current script url.
    const imports = await esbuildImports(baseUrl);
    return imports;
}
