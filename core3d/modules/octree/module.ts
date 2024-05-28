import { type DeviceProfile, type MaxActiveTextures, type PBRMaterialCommon, type PBRMaterialTextures, type RenderContext } from "core3d";
import type { RenderModule } from "..";
import { glUBOProxy, type TextureParams2DArrayUncompressedMipMapped, type TextureParams2DUncompressed, type UncompressedTextureFormatType, type UniformTypes } from "webgl2";
import type { ResourceBin } from "core3d/resource";
import { OctreeModuleContext } from "./context";
import { NodeLoader } from "./loader";

/** @internal */
export const enum ShaderPass { color, pick, pre };
/** @internal */
export const enum ShaderMode { triangles, points, terrain };
/** @internal */
export const enum Gradient { size = 1024 };

/** @internal */
export class OctreeModule implements RenderModule {
    readonly kind = "octree";
    readonly sceneUniforms = {
        applyDefaultHighlight: "bool",
        iblMipCount: "float",
        pixelSize: "float",
        maxPixelSize: "float",
        metricSize: "float",
        toleranceFactor: "float",
        deviationIndex: "int",
        deviationFactor: "float",
        deviationRange: "vec2",
        deviationVisibleRangeStart: "float",
        deviationVisibleRangeEnd: "float",
        deviationUndefinedColor: "vec4",
        useProjectedPosition: "bool",
        elevationRange: "vec2",
        pickOpacityThreshold: "float",
    } as const satisfies Record<string, UniformTypes>;

    readonly gradientImageParams: TextureParams2DUncompressed = { kind: "TEXTURE_2D", width: Gradient.size, height: 2, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: null };
    readonly maxHighlights = 8;

    static readonly textureNames = ["unlit_color", "ibl.diffuse", "ibl.specular", "materials", "highlights", "gradients", "lut_ggx", "base_color", "nor"] as const;
    static readonly textureUniforms = OctreeModule.textureNames.map(name => `textures.${name}`);
    static readonly uniformBufferBlocks = ["Camera", "Clipping", "Scene", "Node"];
    static readonly passes = [ShaderPass.color, ShaderPass.pick, ShaderPass.pre] as const;
    static readonly modes = [ShaderMode.triangles, ShaderMode.points, ShaderMode.terrain] as const;

    async withContext(context: RenderContext) {
        const uniforms = this.createUniforms();
        const resources = await this.createResources(context, uniforms);

        const loader = new NodeLoader(context.imports.loaderWorker);
        const maxObjects = 10_000_000;// TODO: Get from device profile?
        const maxByteLength = maxObjects + 4; // add four bytes for mutex
        const buffer = new SharedArrayBuffer(maxByteLength);
        await loader.init(buffer, context.imports.parserWasm);
        return new OctreeModuleContext(context, this, uniforms, resources, buffer, loader);
    }

    createUniforms() {
        return {
            scene: glUBOProxy(this.sceneUniforms),
        } as const;
    }

    async createResources(context: RenderContext, uniforms: Uniforms) {
        const shaders = context.imports.shaders.octree;
        const bin = context.resourceBin("Watermark");
        const sceneUniforms = bin.createBuffer({ kind: "UNIFORM_BUFFER", srcData: uniforms.scene.buffer });
        const samplerNearest = bin.createSampler({ minificationFilter: "NEAREST", magnificationFilter: "NEAREST", wrap: ["CLAMP_TO_EDGE", "CLAMP_TO_EDGE"] });
        const defaultBaseColorTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 1, height: 1, internalFormat: "RGBA8", type: "UNSIGNED_BYTE", image: new Uint8Array([255, 255, 255, 255]) });
        const materialTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 256, height: 1, internalFormat: "SRGB8_ALPHA8", type: "UNSIGNED_BYTE", image: null });
        const highlightTexture = bin.createTexture({ kind: "TEXTURE_2D", width: 256, height: 8, internalFormat: "RGBA32F", type: "FLOAT", image: null });
        const gradientsTexture = bin.createTexture(this.gradientImageParams);

        let vb_line: WebGLBuffer | null = null;
        let vao_line: WebGLVertexArrayObject | null = null;
        if (context.deviceProfile.features.outline) {
            vb_line = bin.createBuffer({ kind: "ARRAY_BUFFER", byteSize: this.maxLines * 24, usage: "STATIC_DRAW" });
            vao_line = bin.createVertexArray({
                attributes: [
                    { kind: "FLOAT_VEC4", buffer: vb_line, byteStride: 36, byteOffset: 0, componentType: "FLOAT", divisor: 1 }, // positions in plane space (line vertex pair)
                    { kind: "FLOAT_VEC4", buffer: vb_line, byteStride: 36, byteOffset: 16, componentType: "FLOAT", divisor: 1 }, // color
                    { kind: "UNSIGNED_INT", buffer: vb_line, byteStride: 36, byteOffset: 32, componentType: "UNSIGNED_INT", divisor: 1 }, // object_id
                ],
            });
        }

        const { textureUniforms, uniformBufferBlocks } = OctreeModule;
        const programs = await OctreeModule.compileShaders(context, bin);
        // const [/*color, pick, pre,*/  line, point, debug, corePrograms] = await Promise.all([
        //     // context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: OctreeModule.shaderConstants(ShaderPass.color, ShaderMode.triangles) }),
        //     // context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: OctreeModule.shaderConstants(ShaderPass.pick, ShaderMode.triangles) }),
        //     // context.makeProgramAsync(bin, { ...shaders.render, uniformBufferBlocks, textureUniforms, header: OctreeModule.shaderConstants(ShaderPass.pre, ShaderMode.triangles) }),
        //     context.makeProgramAsync(bin, { name: "octree_line", ...shaders.line, uniformBufferBlocks: ["Camera", "Clipping", "Outline"], header: { flags: context.deviceProfile.quirks.adreno600 ? ["ADRENO600"] : [] } }),
        //     context.makeProgramAsync(bin, { name: "octree_point", ...shaders.point, uniformBufferBlocks: ["Camera", "Clipping", "Outline"], header: { flags: context.deviceProfile.quirks.adreno600 ? ["ADRENO600"] : [] } }),
        //     context.makeProgramAsync(bin, { name: "octree_debug", ...shaders.debug, uniformBufferBlocks }),
        //     shadersPromise,
        // ]);
        // const programs = { color, pick, pre, intersect, line, debug };
        // const programs = { intersect, line, debug };
        //const programs = { ...compilePrograms };
        return {
            bin, programs,
            sceneUniforms, samplerNearest, defaultBaseColorTexture, materialTexture, highlightTexture, gradientsTexture
        } as const;
    }

    static readonly defaultProgramFlags = {
        clippingPlanes: 0 as number,
        dither: false as boolean,
        highlight: false as boolean,
        pbr: false as boolean,
    } as const;

    static shaderConstants(deviceProfile: DeviceProfile, pass: ShaderPass, mode: ShaderMode, programFlags = OctreeModule.defaultProgramFlags) {
        const { clippingPlanes, dither, highlight, pbr } = programFlags;
        const flags: string[] = [];
        if (deviceProfile.quirks.slowShaderRecompile) { //Always complie in clip on devices with slow recomplie.
            flags.push("SLOW_RECOMPILE");
        }
        if (dither) {
            flags.push("DITHER");
        }
        if (highlight) {
            flags.push("HIGHLIGHT");
        }
        if (pbr) {
            flags.push("PBR");
        }
        if (deviceProfile.quirks.adreno600) {
            flags.push("ADRENO600");
        }
        if (deviceProfile.quirks.iosInterpolationBug) {
            flags.push("IOS_INTERPOLATION_BUG");
        }
        const defines = [
            { name: "PASS", value: pass.toString() },
            { name: "MODE", value: mode.toString() }
        ];
        if (deviceProfile.quirks.slowShaderRecompile) { //Change clipping loop for shaders with slow shader recompilation
            flags.push("SLOW_RECOMPILE");
        } else {
            defines.push({ name: "NUM_CLIPPING_PLANES", value: clippingPlanes.toString() });
        }
        return { defines, flags } as const;
    }

    static outlineShaderConstants(deviceProfile: DeviceProfile, programFlags = OctreeModule.defaultProgramFlags) {
        const { clippingPlanes, dither, highlight, pbr } = programFlags;
        const flags: string[] = [];
        if (deviceProfile.quirks.slowShaderRecompile) { //Always complie in clip on devices with slow recomplie.
            flags.push("SLOW_RECOMPILE");
        }
        const defines = deviceProfile.quirks.slowShaderRecompile ?
            [] :
            [{ name: "NUM_CLIPPING_PLANES", value: clippingPlanes.toString() }];
        return { defines, flags } as const;
    }

    static async compileShaders(context: RenderContext, bin: ResourceBin, programFlags = OctreeModule.defaultProgramFlags): Promise<Programs> {
        const shaders = context.imports.shaders.octree;
        const { textureUniforms, uniformBufferBlocks } = OctreeModule;
        const corePrograms = {} as Mutable<PassPrograms>;
        const promises: Promise<void>[] = [];
        for (const pass of OctreeModule.passes) {
            const modes = {} as Mutable<ModePrograms>;
            for (const mode of OctreeModule.modes) {
                const promise = context.makeProgramAsync(bin, { name: `octree_render_${pass}_${mode}`, ...shaders.render, uniformBufferBlocks, textureUniforms, header: OctreeModule.shaderConstants(context.deviceProfile, pass, mode, programFlags) });
                const compiledPromise = promise.then(program => {
                    modes[mode] = program;
                });
                promises.push(compiledPromise);
            }
            corePrograms[pass] = modes;
        }

        const [/*color, pick, pre,*/  line, point, debug] = await Promise.all([
            context.makeProgramAsync(bin, { name: "octree_line", ...shaders.line, uniformBufferBlocks: ["Camera", "Clipping", "Outline"], header: OctreeModule.outlineShaderConstants(context.deviceProfile, programFlags) }),
            context.makeProgramAsync(bin, { name: "octree_point", ...shaders.point, uniformBufferBlocks: ["Camera", "Clipping", "Outline"], header: OctreeModule.outlineShaderConstants(context.deviceProfile, programFlags) }),
            context.makeProgramAsync(bin, { name: "octree_debug", ...shaders.debug, uniformBufferBlocks }),
        ]);
        const programs: Programs = { ...corePrograms, line, point, debug };
        return programs;
    }

    static createMaterialTextures(bin: ResourceBin, common: PBRMaterialCommon, textures: readonly PBRMaterialTextures[]) {
        if (textures.length == 0) {
            return { color: null, nor: null } as const;
        }
        const { width, height, mipCount } = common;

        function arrayParams(format: UncompressedTextureFormatType, mipMaps: readonly BufferSource[]): TextureParams2DArrayUncompressedMipMapped | undefined {
            if (mipMaps) {
                return {
                    kind: "TEXTURE_2D_ARRAY",
                    width, height, depth: textures.length,
                    ...format,
                    mipMaps,
                };
            }
        }

        // combine all mip map images into an array image
        function flattenMips(key: "albedoTexture" | "norTexture") {
            const mergedMipMaps: BufferSource[] = [];
            for (let i = 0; i < mipCount; i++) {
                const dst = new Uint8Array(textures[0][key][i].byteLength * textures.length);
                let offset = 0;
                for (const texture of textures) {
                    const src = texture[key][i];
                    if (ArrayBuffer.isView(src)) {
                        const srcView = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
                        dst.set(srcView, offset);
                        offset += src.byteLength;
                    }
                }
                mergedMipMaps[i] = dst.buffer;
            }
            return mergedMipMaps;
        }

        // TODO: streamline loading and merging of mipmaps (textureUpdate with x,y,z offsets?)

        const baseColorTextures = flattenMips("albedoTexture");
        const norTextures = flattenMips("norTexture");
        const colorArrayParams = arrayParams({ internalFormat: "R11F_G11F_B10F", type: "UNSIGNED_INT_10F_11F_11F_REV" }, baseColorTextures);
        const norArrayParams = arrayParams({ internalFormat: "RGBA8", type: "UNSIGNED_BYTE" }, norTextures);
        const color = colorArrayParams ? bin.createTexture(colorArrayParams) : null;
        const nor = norArrayParams ? bin.createTexture(norArrayParams) : null;
        return { color, nor } as const;
    }

    static createMaterialTextureArrays(bin: ResourceBin, common: PBRMaterialCommon, size: MaxActiveTextures) {
        function arrayParams(format: UncompressedTextureFormatType): TextureParams2DArrayUncompressedMipMapped {
            const { width, height, mipCount } = common;
            return {
                kind: "TEXTURE_2D_ARRAY",
                width, height, depth: size,
                ...format,
                mipMaps: mipCount,
            };
        }
        const color = bin.createTexture(arrayParams({ internalFormat: "R11F_G11F_B10F", type: "UNSIGNED_INT_10F_11F_11F_REV" }));
        const nor = bin.createTexture(arrayParams({ internalFormat: "RGBA8", type: "UNSIGNED_BYTE" }));
        return { color, nor } as const;
    }

    static disposeMaterialTextures(bin: ResourceBin, textures: MaterialTextures | undefined) {
        if (textures) {
            const { color, nor } = textures;
            bin.delete(color, nor);
        }
    }

    readonly maxLines = 1024 * 1024; // TODO: find a proper size!
}

export type MaterialTextures = ReturnType<typeof OctreeModule.createMaterialTextures>;

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
/** @internal */
export type Uniforms = ReturnType<OctreeModule["createUniforms"]>;
/** @internal */
export type Resources = Awaited<ReturnType<OctreeModule["createResources"]>>;
type PassPrograms = { readonly [P in keyof typeof ShaderPass]: ModePrograms };
type ModePrograms = { readonly [P in keyof typeof ShaderMode]: WebGLProgram };
/** @internal */
export interface Programs extends PassPrograms {
    readonly line: WebGLProgram;
    readonly point: WebGLProgram;
    readonly debug: WebGLProgram;
}

