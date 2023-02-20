import { glExtensions } from "./extensions";

export type ShaderExtensionName = "GL_ANGLE_multi_draw";

export function* glShaderExtensions(gl: WebGL2RenderingContext): IterableIterator<ShaderExtension> {
    if (glExtensions(gl).multiDraw) {
        yield {
            name: "GL_ANGLE_multi_draw",
            behaviour: "require",
        } as const satisfies ShaderExtension;
    }
}


export function glCompile(gl: WebGL2RenderingContext, params: ShaderParams): WebGLShader {
    const source = params.shader ?? "void main() {}";
    const shader = gl.createShader(gl[params.kind])!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

// remember to call gl.LinkProgram(program) on the returned program
// call glCheckProgram() to check for completely and verify status
export function glProgramAsync(gl: WebGL2RenderingContext, params: ProgramAsyncParams) {
    const { header } = params;
    const headerCode = formatHeader(gl, header);
    const vertex = glCompile(gl, { kind: "VERTEX_SHADER", shader: headerCode + params.vertexShader });
    const fragment = glCompile(gl, { kind: "FRAGMENT_SHADER", shader: headerCode + (params.fragmentShader ?? "") });
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    return { program, vertex, fragment } as const;
}

export function glCheckProgram(gl: WebGL2RenderingContext, params: ReturnType<typeof glProgramAsync>) {
    const { program, vertex, fragment } = params;
    if (gl.getProgramParameter(program, gl.LINK_STATUS) || gl.isContextLost()) {
        console.assert(gl.getProgramParameter(program, gl.ATTACHED_SHADERS) == 2); // make sure not to call this function again after it returns true!
        gl.detachShader(program, vertex);
        gl.detachShader(program, fragment);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
    } else {
        const status = { link: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment) } as const;
        return status;
    }
}

export function glProgram(gl: WebGL2RenderingContext, params: ProgramParams) {
    const { flags, transformFeedback, uniformBufferBlocks, textureUniforms, headerChunk, commonChunk } = params;
    const extensions: string[] = [];
    if (glExtensions(gl).multiDraw) {
        extensions.push("#extension GL_ANGLE_multi_draw : require\n");
    }
    const defaultHeader = `#version 300 es\n${extensions.join("")}precision highp float;\nprecision highp int;\nprecision highp usampler2D;\n`;
    const header = headerChunk ?? defaultHeader;
    const defines = flags?.map(flag => `#define ${flag}\n`)?.join("") ?? "";
    const common = commonChunk ?? "";
    const vs = header + defines + common + params.vertexShader;
    const fs = header + defines + common + (params.fragmentShader ?? "void main() {}");
    const vertexShader = compileShader(gl, "VERTEX_SHADER", vs);
    const fragmentShader = compileShader(gl, "FRAGMENT_SHADER", fs);
    const program = gl.createProgram()!;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transformFeedback) {
        const { varyings, bufferMode } = transformFeedback;
        gl.transformFeedbackVaryings(program, varyings, gl[bufferMode]);
    }

    // TODO: Consider doing async linking, so as to take advantage of parallel shader compilation. (https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#Compile_Shaders_and_Link_Programs_in_parallel)
    gl.linkProgram(program);
    gl.validateProgram(program);

    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost())
        throw new Error(`Failed to compile link shaders!\r\n${gl.getProgramInfoLog(program)}`);

    if (uniformBufferBlocks) {
        let idx = 0;
        for (const name of uniformBufferBlocks) {
            if (name) {
                const blockIndex = gl.getUniformBlockIndex(program, name);
                if (blockIndex != gl.INVALID_INDEX) {
                    gl.uniformBlockBinding(program, blockIndex, idx);
                } else {
                    console.warn(`Shader has no uniform block named: ${name}!`);
                }
            }
            idx++;
        }
    }

    if (textureUniforms) {
        gl.useProgram(program);
        let i = 0;
        for (const name of textureUniforms) {
            const location = gl.getUniformLocation(program, name);
            gl.uniform1i(location, i++);
        }
        gl.useProgram(null);
    }

    return program;
}

function compileShader(gl: WebGL2RenderingContext, type: "VERTEX_SHADER" | "FRAGMENT_SHADER", source: string): WebGLShader {
    const shader = gl.createShader(gl[type])!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        const typeName = type.split("_")[0].toLocaleLowerCase();
        const errorMsg = gl.getShaderInfoLog(shader);
        throw new Error(`: Failed to compile glsl ${typeName} shader!\r\n${errorMsg}`);
    }
    return shader;
}

function defaultHeaderParams(gl: WebGL2RenderingContext): ShaderHeaderParams {
    return {
        version: "300 es",
        extensions: [...glShaderExtensions(gl)],
        defaultPrecisions: {
            float: "high",
            int: "high",
            sampler2D: "high",
            samplerCube: "high",
            sampler3D: "high",
            samplerCubeShadow: "high",
            sampler2DShadow: "high",
            sampler2DArray: "high",
            sampler2DArrayShadow: "high",
            isampler2D: "high",
            isampler3D: "high",
            isamplerCube: "high",
            isampler2DArray: "high",
            usampler2D: "high",
            usampler3D: "high",
            usamplerCube: "high",
            usampler2DArray: "high",
        },
        flags: [],
        defines: [],
        commonChunk: "",
    } as const satisfies ShaderHeaderParams;
}

function formatHeader(gl: WebGL2RenderingContext, params: string | Partial<ShaderHeaderParams> | undefined): string {
    if (!params)
        return "";
    if (typeof params == "string")
        return params;
    const p = { ...defaultHeaderParams(gl), ...params };
    const version = `#version ${p.version}\n`;
    const extensions = p.extensions.map(ext => `#extension ${ext.name} : ${ext.behaviour}\n`).join("");
    const precisions = Object.entries(p.defaultPrecisions).map(([type, precision]) => (`precision ${precision}p ${type};\n`)).join("");
    const flags = p.flags.map(flag => `#define ${flag}\n`).join("");
    const defines = p.defines.map(def => `#define ${def.name} ${def.value}\n`).join("");
    const common = p.commonChunk;
    const header = version + extensions + precisions + flags + defines + common;
    return header;
}


export interface ProgramAsyncParams {
    readonly header?: string | Partial<ShaderHeaderParams>;
    readonly vertexShader: string;
    readonly fragmentShader: string | undefined;
}

export interface VertexShaderParams {
    readonly kind: "VERTEX_SHADER";
    readonly shader: string;
}

export interface FragmentShaderParams {
    readonly kind: "FRAGMENT_SHADER";
    readonly shader?: string;
}

export type ShaderParams = VertexShaderParams | FragmentShaderParams;

export interface ShaderExtension {
    readonly name: ShaderExtensionName | string;
    readonly behaviour: "enable" | "require" | "warn" | "disable";
}

export interface ShaderDefine {
    readonly name: string;
    readonly value?: string;
}

export type ShaderPrecision = "high" | "medium" | "low";

export interface ShaderDefaultPrecisions {
    readonly float: ShaderPrecision; // high in vert shader, no default value in frag shader
    readonly int: ShaderPrecision; // high in vert shader, medium in frag shader.

    // lowp by default
    readonly sampler2D: ShaderPrecision;
    readonly samplerCube: ShaderPrecision;

    // no default value
    readonly sampler3D: ShaderPrecision;
    readonly samplerCubeShadow: ShaderPrecision;
    readonly sampler2DShadow: ShaderPrecision;
    readonly sampler2DArray: ShaderPrecision;
    readonly sampler2DArrayShadow: ShaderPrecision;
    readonly isampler2D: ShaderPrecision;
    readonly isampler3D: ShaderPrecision;
    readonly isamplerCube: ShaderPrecision;
    readonly isampler2DArray: ShaderPrecision;
    readonly usampler2D: ShaderPrecision;
    readonly usampler3D: ShaderPrecision;
    readonly usamplerCube: ShaderPrecision;
    readonly usampler2DArray: ShaderPrecision;
}

export interface ShaderHeaderParams {
    readonly version: "300 es";
    readonly extensions: readonly ShaderExtension[];
    readonly defaultPrecisions: Partial<ShaderDefaultPrecisions>;
    readonly flags: readonly string[]; // flags are turned into preprocessor #define's with no values (#ifdef)
    readonly defines: readonly ShaderDefine[]; // Preprocessor #define statements.
    readonly commonChunk: string; // this string is injected before the shader code prior to compilation
}

export interface ProgramParams {
    readonly vertexShader: string;
    readonly fragmentShader?: string;
    readonly headerChunk?: string; // this string is injected at the very top of shaders prior to compilation for things that must come before #define's, such as #version and extention directives
    readonly flags?: readonly string[]; // flags are turned into preprocessor #define's with no values (#ifdef)
    readonly commonChunk?: string; // this string is injected before the shader code prior to compilation
    readonly uniformBufferBlocks?: string[]; // The names of the shader uniform blocks, which will be bound to the index in which the name appears in this array using gl.uniformBlockBinding().
    readonly textureUniforms?: readonly string[]; // Texture uniforms will be bound to the index in which they appear in the name array.
    readonly transformFeedback?: {
        readonly bufferMode: "INTERLEAVED_ATTRIBS" | "SEPARATE_ATTRIBS";
        readonly varyings: readonly string[];
    }
}

