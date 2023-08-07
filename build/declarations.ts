import * as ts from "typescript"
import { dirname, join, relative, resolve } from 'path/posix'
import { existsSync } from "fs";
// import { resolve } from "path";

// thanks to: https://github.com/dropbox/ts-transform-import-path-rewrite and https://github.com/jeremyben/tsc-prog

export function declarations(basePath: string, configFilePath = "tsconfig.json") {
    const configPath = resolve(basePath, configFilePath);
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) {
        logDiagnostics([error]);
    }
    const declOptions: ts.CompilerOptions = {
        // declaration: true,
        // declarationMap: true,
        // emitDeclarationOnly: true,
        // declarationDir: "./types/",
    };
    // TODO: clearn up decldir++
    const { options, fileNames, projectReferences, errors } =
        ts.parseJsonConfigFileContent(config, ts.sys, basePath, declOptions, configFilePath);
    logDiagnostics(errors);
    if (errors.length > 0) {
        throw errors;
    }

    const host = ts.createCompilerHost(options);
    const program = ts.createProgram({ options, rootNames: fileNames, projectReferences, host });

    const transformer = transform({ basePath });

    const emitOnlyDtsFiles = true;
    const emitResult = program.emit(undefined, undefined, undefined, emitOnlyDtsFiles, {
        // after: [transformer],
        afterDeclarations: [transformer]
    });

    const diagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    logDiagnostics(diagnostics);
}

interface TransformOptions {
    basePath?: string
}

function rewritePath(importPath: string, sf: ts.SourceFile, opts: TransformOptions) {
    // try to make absolute paths relative, since d.ts files don't respect the baseUrl or paths config properties.
    if (!importPath.startsWith(".")) {
        const absoluteImportPath = join(opts.basePath!, importPath);
        if (existsSync(absoluteImportPath)) {
            const relativePath = relative(dirname(sf.fileName), absoluteImportPath);
            return relativePath;
        }
    }
    return importPath;
}

function transform(opts: TransformOptions): ts.CustomTransformerFactory {
    return (ctx: ts.TransformationContext) => {
        function transformSourceFile(sf: ts.SourceFile) {
            return ts.visitNode(sf, importExportVisitor(ctx, sf, opts)) as ts.SourceFile;
        }
        function transformBundle(bundle: ts.Bundle) {
            console.error("Bundles are not supported!");
            return bundle;
        }
        return { transformSourceFile, transformBundle };
    }
}

function isDynamicImport(node: ts.Node): node is ts.CallExpression {
    return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function importExportVisitor(
    ctx: ts.TransformationContext,
    sf: ts.SourceFile,
    opts: TransformOptions,
) {
    const visitor: ts.Visitor = (node: ts.Node): ts.Node => {
        let importPath: string | undefined = undefined;
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            const importPathWithQuotes = node.moduleSpecifier.getText(sf)
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
        } else if (isDynamicImport(node)) {
            const importPathWithQuotes = node.arguments[0].getText(sf)
            importPath = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2)
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)
        ) {
            importPath = node.argument.literal.text // `.text` instead of `getText` bc this node doesn't map to sf (it's generated d.ts)
        }

        if (importPath) {
            const rewrittenPath = rewritePath(importPath, sf, opts)

            // Only rewrite relative path
            if (rewrittenPath !== importPath) {
                if (ts.isImportDeclaration(node)) {
                    return ctx.factory.updateImportDeclaration(
                        node,
                        node.modifiers,
                        node.importClause,
                        ctx.factory.createStringLiteral(rewrittenPath),
                        node.assertClause,
                    );
                } else if (ts.isExportDeclaration(node)) {
                    return ctx.factory.updateExportDeclaration(
                        node,
                        node.modifiers,
                        node.isTypeOnly,
                        node.exportClause,
                        ctx.factory.createStringLiteral(rewrittenPath),
                        node.assertClause,
                    );
                } else if (isDynamicImport(node)) {
                    return ctx.factory.updateCallExpression(
                        node,
                        node.expression,
                        node.typeArguments,
                        ctx.factory.createNodeArray([
                            ctx.factory.createStringLiteral(rewrittenPath),
                        ])
                    );
                } else if (ts.isImportTypeNode(node)) {
                    return ctx.factory.updateImportTypeNode(
                        node,
                        ctx.factory.createLiteralTypeNode(
                            ctx.factory.createStringLiteral(rewrittenPath)
                        ),
                        node.assertions,
                        node.qualifier,
                        node.typeArguments,
                        node.isTypeOf
                    );
                }
            }
            return node;
        }
        return ts.visitEachChild(node, visitor, ctx);
    }
    return visitor;
}

function logDiagnostics(diagnostics: readonly ts.Diagnostic[]) {
    let hasError = false;
    for (const diagnostic of diagnostics) {
        if (diagnostic.file && diagnostic.start != undefined) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
                diagnostic.start
            );
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            const str = `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
            switch (diagnostic.category) {
                case ts.DiagnosticCategory.Error:
                    console.error(str);
                    break;
                case ts.DiagnosticCategory.Warning:
                    console.warn(str);
                    break;
                default:
                    console.info(str);
                    break;
            }
        }
    }
    if (hasError) {
        throw new Error(`Failed to create typescript declaration files!`);
    }
}
