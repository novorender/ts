//import(`/dist/${window.location.search.substring(1)}.js`);
import { glMatrix } from "gl-matrix";
import { createWebGL2Renderer, resizeCanvasToDisplaySize } from "..";
import { hello_triangle } from "./hello_triangle";
import { spinning_cube } from "spinning_cube";

glMatrix.setMatrixArrayType(Array);

const canvas = document.getElementById("output") as HTMLCanvasElement;
const selector = document.getElementById("example_selector") as HTMLSelectElement;
selector.onchange = (e) => {
    useExample(selector.value);
}
const params = new URLSearchParams(window.location.search);
const ex = localStorage.getItem("example") ?? params.get("example") ?? "hello_triangle";
useExample(ex);

let animFrameHandle = -1;

async function useExample(example: string) {
    if (animFrameHandle > 0)
        cancelAnimationFrame(animFrameHandle);
    localStorage.setItem("example", example);
    selector.value = example;

    const renderer = createWebGL2Renderer(canvas, {
        alpha: true,
        antialias: false,
        depth: true,
        desynchronized: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        stencil: false,
    });

    resizeCanvasToDisplaySize(canvas);

    let renderFunc: ((time: number) => void) | void;

    switch (example) {
        case "hello_triangle":
            renderFunc = await hello_triangle(renderer);
            break;
        case "spinning_cube":
            renderFunc = await spinning_cube(renderer);
            break;
        default:
            alert(`Unknown example ${example}!`);
            break;
    }

    if (renderFunc) {
        const startTime = performance.now();
        animFrameHandle = requestAnimationFrame(function cb(time: number) {
            resizeCanvasToDisplaySize(canvas);
            renderFunc!(time);
            if (time < startTime + 10000)
                animFrameHandle = requestAnimationFrame(cb);
        });
    }


    renderer.dispose();
}
