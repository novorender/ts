import { mat4, vec2, vec4, type ReadonlyVec3, type ReadonlyVec2, glMatrix, vec3 } from "gl-matrix";
import type { Camera, DrawContext } from "measure";

const SCREEN_SPACE_EPSILON = 0.001;

export class ScreenSpaceConversions {
    constructor(readonly drawContext: DrawContext) { }

    /** Check if world space point is inside the current view.
     * @param point World space point that will be checked.
     * @returns True if the point is inside the view false otherwise.
     */
    isInView(point: ReadonlyVec3) {
        const { drawContext } = this;
        const { width, height } = drawContext;
        const vsPoint = this.worldSpaceToScreenSpace([point]);
        if (vsPoint[0] == undefined) { // behind the camera 
            return false;
        }
        if (vsPoint[0][0] < 0 || vsPoint[0][0] > width ||
            vsPoint[0][1] < 0 || vsPoint[0][1] > height
        ) {
            return false;
        }
        return true;
    }

    /** Converts world space points to on screen space points.
     * @param points World space points that will be projected to screen space.
     * @returns Screen space points regadless if they are within the current canvas size
     *          or undefined if point is outside screen space.
     */
    worldSpaceToScreenSpace(points: ReadonlyVec3[]): (ReadonlyVec2 | undefined)[] {
        const { drawContext } = this;
        const { width, height, camera } = drawContext;
        const { camMat, projMat } = getPathMatrices(width, height, camera);
        const p = vec3.create();
        return points.map((p0) => {
            vec3.transformMat4(p, p0, camMat);

            if (camera.kind === "orthographic") {
                if (p[2] > 0 && p[2] < 0.1) {
                    p[2] = -0.0001;
                }
            }

            if (p[2] > SCREEN_SPACE_EPSILON) {
                return undefined;
            }

            return toScreen(projMat, width, height, p);
        });
    }

    /** Converts world space points to view space points.
     * @param points World space points that will be projected to view space.
     * @returns View space points regadless if they are within the current canvas size.
     *          Coordinates are in [0, 1] range.
     */
    worldSpaceToViewSpace(points: ReadonlyVec3[]): ReadonlyVec2[] {
        const { drawContext } = this;
        const { width, height, camera } = drawContext;
        const { camMat, projMat } = getPathMatrices(width, height, camera);
        const p = vec3.create();
        return points.map((p0) => {
            vec3.transformMat4(p, p0, camMat);

            if (camera.kind === "orthographic") {
                if (p[2] > 0 && p[2] < 0.1) {
                    p[2] = -0.0001;
                }
            }

            return toView(projMat, p);
        });
    }

    /**
     * Convert 2D pixel point to 3D positions.
     * @param points Screen points in points that will be projected to world space.
     * @returns Corresponding 3D positions at the view plane in world space.
     */
    screenSpaceToWorldSpace(points: ReadonlyVec2[]): ReadonlyVec3[] {
        const { drawContext } = this;
        const { width, height, camera } = drawContext;
        const { camMat, projMat: viewClipMatrix } = getPathMatrices(width, height, camera);
        const viewWorldMatrix = mat4.invert(mat4.create(), camMat);
        return points.map((p0) => {
            const [x, y] = p0;
            const px = Math.min(Math.max(0, Math.round(x)), width);
            const py = Math.min(Math.max(0, Math.round(height - y)), height);
            const xCS = ((px + 0.5) / width) * 2 - 1;
            const yCS = ((py + 0.5) / height) * 2 - 1;
            const pos = vec3.fromValues((xCS / viewClipMatrix[0]), (yCS / viewClipMatrix[5]), 0);
            vec3.transformMat4(pos, pos, viewWorldMatrix);
            return pos;
        });
    }
}

function getPathMatrices(width: number, height: number, camera: Camera): { camMat: mat4; projMat: mat4 } {
    // aka viewWorldMatrix
    const camMat = mat4.fromRotationTranslation(
        mat4.create(),
        camera.rotation,
        camera.position
    );
    mat4.invert(camMat, camMat);
    if (camera.kind == "pinhole") {
        const projMat = mat4.perspective(
            mat4.create(),
            glMatrix.toRadian(camera.fov),
            width / height,
            camera.near,
            camera.far
        );
        return { camMat, projMat };
    } else {
        const aspect = width / height;
        const halfHeight = camera.fov / 2;
        const halfWidth = halfHeight * aspect;
        const projMat = mat4.ortho(
            mat4.create(),
            -halfWidth,
            halfWidth,
            -halfHeight,
            halfHeight,
            camera.near,
            camera.far
        );
        return { camMat, projMat };
    }
}

const toView = (() => {
    const _toViewVec1Buf = vec4.create();
    const _toViewVec2Buf = vec4.create();
    return function toView(projMat: mat4, p: ReadonlyVec3): vec2 {
        vec4.set(_toViewVec2Buf, p[0], p[1], p[2], 1);
        const _p = vec4.transformMat4(
            _toViewVec1Buf,
            _toViewVec2Buf,
            projMat
        );

        const pt = vec2.fromValues(
            ((_p[0] * 0.5) / _p[3] + 0.5),
            (0.5 - (_p[1] * 0.5) / _p[3])
        );

        return pt;
    };
})();

function toScreen(projMat: mat4, width: number, height: number, p: ReadonlyVec3): vec2 {
    const pt = toView(projMat, p);

    pt[0] = Math.round(pt[0] * width);
    pt[1] = Math.round(pt[1] * height);

    if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
        vec2.set(pt, -100, -100);
    }

    return pt;
}