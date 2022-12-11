import { glExtensions } from "./extensions";

export function glProgram(gl: WebGL2RenderingContext, params: ProgramParams) {
    const { flags, transformFeedback, uniformBufferBlocks } = params;
    const extensions: string[] = [];
    if (glExtensions(gl).multiDraw) {
        extensions.push("#extension GL_ANGLE_multi_draw : require\n");
    }
    const header = `#version 300 es\n${extensions.join("")}precision highp float;\nprecision highp int;\nprecision highp usampler2D;\n`;
    const defines = flags?.map(flag => `#define ${flag}\n`)?.join("") ?? "";
    const vs = header + defines + params.vertexShader;
    const fs = header + defines + (params.fragmentShader ?? "void main() {}");
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
                if (blockIndex != 0xffffffff) {
                    gl.uniformBlockBinding(program, blockIndex, idx);
                } else {
                    console.warn(`Shader has no uniform block named: ${name}!`);
                }
            }
            idx++;
        }
    }

    return program;
}

function compileShader(gl: WebGLRenderingContext, type: "VERTEX_SHADER" | "FRAGMENT_SHADER", source: string): WebGLShader {
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

export interface ProgramParams {
    readonly vertexShader: string;
    readonly fragmentShader?: string;
    readonly flags?: readonly string[];
    readonly uniformBufferBlocks?: string[]; // The names of the shader uniform blocks, which will be bound to the index in which the name appears in this array using gl.uniformBlockBinding().
    readonly transformFeedback?: {
        readonly bufferMode: "INTERLEAVED_ATTRIBS" | "SEPARATE_ATTRIBS";
        readonly varyings: readonly string[];
    }
}

