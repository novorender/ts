import { glMatrix } from "gl-matrix";
import { run } from "../";

glMatrix.setMatrixArrayType(Array);

const canvas = document.getElementById("output") as HTMLCanvasElement;
try {
    run(canvas);
} catch (error: any) {
    if (error && "message" in error)
        alert(error.message);
    else
        alert(error);
}