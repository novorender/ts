import type { RendererContext, ProgramParams } from ".";

export type ProgramIndex = number;

type ShaderType = "VERTEX_SHADER" | "FRAGMENT_SHADER";

function compileShader(gl: WebGLRenderingContext, type: ShaderType, source: string): WebGLShader {
    const shader = gl.createShader(gl[type]);
    if (!shader) throw new Error("WebGL Shader could not be created.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const typeName = type.split("_")[0].toLocaleLowerCase();
        const errorMsg = gl.getShaderInfoLog(shader);
        throw new Error(`: Failed to compile glsl ${typeName} shader!\r\n${errorMsg}`);
    }
    return shader;
}

export function createProgram(context: RendererContext, params: ProgramParams) {
    const { gl } = context;
    const { flags, transformFeedback, uniformBufferBlocks } = params;
    const extensions: string[] = [];
    if (context.extensions.multiDraw) {
        extensions.push("#extension GL_ANGLE_multi_draw : require\n");
    }
    const header = `#version 300 es\n${extensions.join()}precision highp float;\n`;
    const defines = flags?.map(flag => `#define ${flag}\n`)?.join() ?? "";
    const vs = header + defines + params.vertexShader;
    const fs = header + defines + (params.fragmentShader ?? "void main() {}");
    const vertexShader = compileShader(gl, "VERTEX_SHADER", vs);
    const fragmentShader = compileShader(gl, "FRAGMENT_SHADER", fs);
    const program = gl.createProgram();
    if (!program)
        throw new Error("Could not create WebGL shader program!");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    if (transformFeedback) {
        const { varyings, bufferMode } = transformFeedback;
        gl.transformFeedbackVaryings(program, varyings, gl[bufferMode]);
    }

    // TODO: Consider doing linking in a separate stage, so as to take advantage of parallel shader compilation. (https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#Compile_Shaders_and_Link_Programs_in_parallel)
    gl.linkProgram(program);
    gl.validateProgram(program);

    gl.detachShader(program, vertexShader);
    gl.detachShader(program, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(`Failed to compile link shaders!\r\n${gl.getProgramInfoLog(program)}`);

    if (uniformBufferBlocks) {
        let idx = 0;
        for (const name of uniformBufferBlocks) {
            if (name) {
                const blockIndex = gl.getUniformBlockIndex(program, name);
                if (blockIndex != -1) {
                    gl.uniformBlockBinding(program, blockIndex, idx);
                }
            }
            idx++;
        }
    }

    return program;
}
