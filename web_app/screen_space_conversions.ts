import { mat4, vec2, vec4, type ReadonlyVec3, type ReadonlyVec2, glMatrix, vec3 } from "gl-matrix";
import type { Camera, DrawContext } from "measure";

const SCREEN_SPACE_EPSILON = 0.001;

export class ScreenSpaceConversions {
    constructor(readonly drawContext: DrawContext) {}

    worldSpaceToScreenSpace(points: ReadonlyVec3[], round = true): (ReadonlyVec2 | undefined)[] {
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

            return toScreen(projMat, width, height, p, round);
        });
    }

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
}

function getPathMatrices(width: number, height: number, camera: Camera): { camMat: mat4; projMat: mat4 } {
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

const toScreen = (() => {
    const _toScreenVec1Buf = vec4.create();
    const _toScreenVec2Buf = vec4.create();
    return function toScreen(projMat: mat4, width: number, height: number, p: ReadonlyVec3, round: boolean): ReadonlyVec2 {
        vec4.set(_toScreenVec2Buf, p[0], p[1], p[2], 1);
        const _p = vec4.transformMat4(
            _toScreenVec1Buf,
            _toScreenVec2Buf,
            projMat
        );

        const pt = vec2.fromValues(
            ((_p[0] * 0.5) / _p[3] + 0.5) * width,
            (0.5 - (_p[1] * 0.5) / _p[3]) * height
        );

        if (round) {
            pt[0] = Math.round(pt[0]);
            pt[1] = Math.round(pt[1]);
        }

        if (!Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
            vec2.set(pt, -100, -100);
        }
        return pt;
    };
})();

const toView = (() => {
    const _toViewVec1Buf = vec4.create();
    const _toViewVec2Buf = vec4.create();
    return function toView(projMat: mat4, p: ReadonlyVec3): ReadonlyVec2 {
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