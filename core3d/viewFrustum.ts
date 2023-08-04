import { glMatrix, mat4, vec3, vec4 } from "gl-matrix";
import { type RenderState, CoordSpace, type Matrices, type ViewFrustum } from "./state";

/**
 * Create a view frustum.
 * @param state The render state to use.
 * @param state The transformation matrices to use.
 * @returns A view frustum, in world space.
 * @category Render Module
*/
export function createViewFrustum(state: RenderState, matrices: Matrices): ViewFrustum {
    const { camera, output } = state;
    const { width, height } = output;
    const aspect = width / height;
    const halfHeight = camera.fov / 2;
    const halfWidth = halfHeight * aspect;

    const left = vec4.create();
    const right = vec4.create();
    const top = vec4.create();
    const bottom = vec4.create();
    const near = vec4.create();
    const far = vec4.create();
    const image = vec4.create();

    vec4.set(near, 0, 0, 1, -camera.near);
    vec4.set(far, 0, 0, -1, camera.far);
    vec4.set(image, 0, 0, -1, 0);

    if (camera.kind == "orthographic") {
        vec4.set(left, -1, 0, 0, halfWidth);
        vec4.set(right, 1, 0, 0, halfWidth);
        vec4.set(top, 0, 1, 0, halfHeight);
        vec4.set(bottom, 0, -1, 0, halfHeight);
    } else {
        const halfAngleY = glMatrix.toRadian(camera.fov / 2);
        const halfAngleX = Math.atan(Math.tan(halfAngleY) * aspect);
        vec4.set(left, -Math.cos(halfAngleX), 0, Math.sin(halfAngleX), 0);
        vec4.set(right, Math.cos(halfAngleX), 0, Math.sin(halfAngleX), 0);
        vec4.set(top, 0, Math.cos(halfAngleY), Math.sin(halfAngleY), 0);
        vec4.set(bottom, 0, -Math.cos(halfAngleY), Math.sin(halfAngleY), 0);
    }

    // transform into world space
    const normal = vec3.create();
    const position = vec3.create();
    const matrix = matrices.getMatrix(CoordSpace.View, CoordSpace.World);
    const matrixNormal = matrices.getMatrixNormal(CoordSpace.View, CoordSpace.World);
    mat4.getTranslation(position, matrix);
    const planes = [left, right, top, bottom, near, far, image];
    for (const plane of planes) {
        const [x, y, z, offset] = plane;
        vec3.set(normal, x, y, z);
        vec3.transformMat3(normal, normal, matrixNormal);
        const distance = offset + vec3.dot(position, normal);
        vec4.set(plane, normal[0], normal[1], normal[2], -distance);
    }
    return { left, right, top, bottom, near, far, image, planes: [left, right, top, bottom, near, far] };
}