export function glStats(gl: WebGL2RenderingContext): GLStatistics | undefined;
export function glStats(gl: WebGL2RenderingContext, ensure: true): GLStatistics;
export function glStats(gl: WebGL2RenderingContext, ensure?: boolean): GLStatistics | undefined {
    let stats = glStatsMap.get(gl);
    if (!stats && ensure) {
        stats = createStats();
        glStatsMap.set(gl, stats!);
    }
    return stats;
}

const glStatsMap = new WeakMap<WebGL2RenderingContext, GLStatistics>();

function createStats() {
    return {
        drawCalls: 0,
        bufferBytes: 0,
        textureBytes: 0,
        renderedPoints: 0,
        renderedLines: 0,
        renderedTriangles: 0,
    };
}

export type GLStatistics = ReturnType<typeof createStats>;
