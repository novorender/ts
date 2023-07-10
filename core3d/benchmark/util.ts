export function waitFrame() {
    return new Promise<number>((resolve) => {
        function animate(time: number) {
            resolve(time);
        }
        requestAnimationFrame(animate);
    });
}

export async function measure(action: (iteration: number) => void) {
    const elapsed: number[] = [];
    let prevTime: number | undefined;

    async function tick() {
        const time = await waitFrame();
        if (prevTime != undefined) {
            elapsed.push(time - prevTime);
        }
        prevTime = time;
    }

    // measure frame interval
    const frames = 6;
    for (let i = 0; i < frames; i++) {
        await tick();
    }
    elapsed.sort((a, b) => a - b);
    const medianInterval = elapsed[Math.round(elapsed.length / 2)]; // use median interval as frame interval
    const fps = Math.round(1000 / medianInterval); // round to nearest FPS
    console.log({ fps });

    let iterations = 1;
    for (; ;) {
        prevTime = undefined;
        elapsed.length = 0;
        for (let i = 0; i < frames; i++) {
            await tick();
            for (let j = 0; j < iterations; j++) {
                action(j);
            }
        }
        elapsed.sort((a, b) => a - b);
        const averageFrameInterval = elapsed.slice(1, elapsed.length - 1).reduce((a, b) => (a + b)) / (elapsed.length - 2); // ignore min and max values
        if (averageFrameInterval > 100) {
            return averageFrameInterval / iterations;
        }
        iterations = Math.max(iterations + 1, Math.round(iterations * 1.75));
        console.log(iterations);
    }
}

function waitSync(gl: WebGL2RenderingContext, sync: WebGLSync) {
    gl.flush();
    let resolve: (value: number) => void = undefined!;
    const promise = new Promise<number>((res) => { resolve = res; });
    (function checkSync(): void {
        const flags = 0; // gl.SYNC_FLUSH_COMMANDS_BIT
        const timeout = 0; // gl.MAX_CLIENT_WAIT_TIMEOUT_WEBGL
        const status = gl.clientWaitSync(sync, flags, timeout);
        switch (status) {
            case gl.TIMEOUT_EXPIRED:
                setTimeout(checkSync);
                return;
            case gl.WAIT_FAILED:
                throw new Error('GPU Sync error!');
        }
        gl.deleteSync(sync);
        resolve(performance.now());
    })();
    return promise;
}
